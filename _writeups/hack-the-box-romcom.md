---
title: "Hack The Box: RomCom"
date: 2026-02-21
summary: "A Very Easy Windows-based defensive lab analyzing Master File Table ($MFT) artifacts to investigate the exploitation of a WinRAR path traversal vulnerability (CVE-2025-8088). Parsing file metadata with MFTECmd reveals how opening a malicious RAR archive extracted a decoy PDF to distract the user while silently dropping a backdoor executable and establishing persistence via a startup shortcut."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/RomCom"
tags:
  - cve-2025-8088
  - dfir
  - mftecmd
  - path-traversal
  - shortcut-modification
  - timeline-explorer
---

### Executive Summary

A Microsoft Defender alert on Susan’s workstation revealed exploitation of a WinRAR path traversal vulnerability, CVE-2025-8088, linked to the RomCom threat group. Susan opened a malicious archive, `Pathology-Department-Research-Records.rar`, which extracted a decoy PDF to appear legitimate while silently deploying the backdoor `C:\Users\Susan\AppData\Local\ApbxHelper.exe`. The attack established persistence through a malicious shortcut placed in the Startup folder, consistent with MITRE ATT&CK technique T1547.009. Timeline analysis confirms successful execution and persistence shortly after the archive was opened.

### Scenario

Susan works at the Research Lab in Forela International Hospital. A Microsoft Defender alert was received from her computer, and she also mentioned that while extracting a document from the received file, she received tons of errors, but the document opened just fine. According to the latest threat intel feeds, WinRAR is being exploited in the wild to gain initial access into networks, and WinRAR is one of the Software programs the staff uses. You are a threat intelligence analyst with some background in DFIR. You have been provided a lightweight triage image to kick off the investigation while the SOC team sweeps the environment to find other attack indicators.

### Provided Artifacts

`2025-09-02T083211_pathology_department_incidentalert.vhdx` (SHA256: `CFE66D446AD9AF61E7C67B0804B4E0EFA923BE16E7CC4087EC56E7A73D578205`)

### Task 1

***Question: What is the CVE assigned to the WinRAR vulnerability exploited by the RomCom threat group in 2025?***

By quick Google search of the main keywords related to the vulnerability, we can easily identify the associated CVE of the vulnerability:

![Figure 1](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

***Answer: CVE-2025-8088***

### Task 2

***Question: What is the nature of this vulnerability?***

As seen in figure 1, the vulnerability is related to path traversal.

***Answer: Path Traversal***

### Task 3

***Question: What is the name of the archive file under Susan's documents folder that exploits the vulnerability upon opening the archive file?***

Let’s start by mounting the provided virtual hard disk into a Windows virtual machine system through right clicking on the file → Mount.

After opening the mounted drive, we can see that it includes an `$MFT` file in the `C` directory:

![Figure 2](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

MFT files store metadata about files and directories in the file system, so we can analyze it to identify the name of the malicious file.

Let’s analyze it using `MFTECmd.exe`, a tool by [Eric Zimmerman](https://ericzimmerman.github.io/#!index.md):

```bash
.\MFTECmd.exe -f 'E:\C\$MFT' --csv C:\Users\Windows10\Desktop\htb\romcom\
```

After the results are saved into the CSV file, let’s open it in Timeline Explorer, another tool by Eric Zimmerman.

After opening it, let’s filter the Extension column for `rar` files. Doing that will result in the following:

![Figure 3](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Notice that there is one row that shows a file that meets both requirements: It is found in Susan’s Documents folder and it is a WinRAR file. This is most likely the malicious file.

***Answer: `Pathology-Department-Research-Records.rar`***

### Task 4

***Question: When was the archive file created on the disk?***

By checking the Created0x10 column for the same row, we can easily identify the creation time.

***Answer: 2025-09-02 08:13:50***

### Task 5

***Question: When was the archive file opened?***

Let’s search the explorer for all records related to the archive name:

![Figure 4](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Notice that there is a link file for the archive file found in the Recent folder. This folder holds data about recently accessed files, folders, and programs.

Therefore, we can use data about this link file to know when the archive file was opened, which can be found in the Last Access0x10 column.

***Answer: 2025-09-02 08:14:04***

### Task 6

***Question: What is the name of the decoy document extracted from the archive file, meant to appear legitimate and distract the user?***

Since the default extraction location is the current folder, it is likely that the files from the archive were extracted into that same folder.

So, let’s filter for records whose Parent Path is the Documents folder:

![Figure 5](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

This file is likely the extracted file.

***Answer: `Genotyping_Results_B57_Positive.pdf`***

### Task 7

***Question: What is the name and path of the actual backdoor executable dropped by the archive file?***

Let’s filter for executable files and check the ones that were created during the timeframe of extracting data from the archive files. Upon doing so, we will identify the following executable created directly after the extraction:

![Figure 6](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

By searching online for this executable name, we can identify many indicators related to the WinRAR attack:

![Figure 7](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

So it is safe to say that this is the backdoor malicious executable.

***Answer: `C:\Users\Susan\Appdata\Local\ApbxHelper.exe`***

### Task 8

***Question: The exploit also drops a file to facilitate the persistence and execution of the backdoor. What is the path and name of this file?***

Persistence files are usually stored in the Startup folder. Keeping this in mind, let’s search for files that are around the timeframe of the extraction.

This can be identified during the search:

![Figure 8](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

An innocent-appearing file found in the Startup folder, identified between the PDF masquerade file and the EXE malicious file.

***Answer: C:\Users\Susan\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Display Settings.lnk***

### Task 9

***Question: What is the associated MITRE Technique ID discussed in the previous question?***

By visiting the MITRE ATT&CK site and checking techniques under Persistence, we can identify that our current case is related to [Boot or Logon Autostart Execution](https://attack.mitre.org/techniques/T1547/) technique.

By checking the subtechniques, the most suitable one is the [Shortcut Modification](https://attack.mitre.org/techniques/T1547/009/) subtechnique, because as seen in Task 8, the persistence file is delivered through a link (shortcut).

***Answer: T1547.009***

### Task 10

***Question: When was the decoy document opened by the end user, thinking it to be a legitimate document?***

Similar to Task 5, we can search for files that hold the same name as the archive and look for a link file. By doing so, we can identify this link file:

![Figure 9](/assets/images/writeups/hack-the-box-romcom/hack-the-box-romcom-fig-10.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

By checking the Last Access0x10 column, we can identify the time of launching the file.

***Answer: 2025-09-02 08:15:05***

---

## Business Impact

### Confidentiality

- A backdoor (`ApbxHelper.exe`) was installed, allowing attackers to access the computer remotely.
- Sensitive research data, internal files, and saved passwords may have been exposed.
- Attackers could use this access to reach other systems in the hospital network.

### Integrity

- The attacker added a malicious program and a Startup shortcut to keep access.
- Files or system settings could be changed without permission.
- The affected computer can no longer be fully trusted.

### Availability

- No immediate downtime was seen.
- However, the attacker could later deploy ransomware or disrupt systems.
- Hospital operations may be impacted if the threat spreads.

## Remediation

- Disconnect the infected computer from the network right away.
- Remove the malicious files or fully reinstall the system if needed.
- Reset the user’s passwords and any other credentials used on the device.
- Update WinRAR on all systems to the latest official version.
- Search other computers for the same malicious files or indicators.
- Train staff to be careful when opening archive files from unknown sources.
