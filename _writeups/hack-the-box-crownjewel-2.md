---
title: "Hack The Box: CrownJewel-2"
date: 2025-12-03
summary: "A Very Easy Windows-based defensive lab analyzing event logs to investigate an unauthorized NTDS.dit dump on a Domain Controller. The analysis identifies the Volume Shadow Copy service activation time, the exact path and creation time of the temporary NTDS dump, and the privileged user groups enumerated by ntdsutil.exe, with Kerberos events pinpointing the attacker's login time with a privileged account."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/CrownJewel-2"
tags:
  - active-directory
  - dfir
  - event-viewer
  - ntds-dit
  - shadow-copy
---

### Executive Summary

Logs show that an attacker with domain admin privileges used ntdsutil.exe on the domain controller to dump the NTDS.dit database. This action triggered the Microsoft Shadow Copy Service and created a temporary NTDS dump on disk. Application logs confirmed the dump path and timestamps. Security logs showed that the tool checked high-privilege groups, and Kerberos events revealed the time the attacker logged in with a privileged account.

### Scenario

Forela's Domain environment is pure chaos. Just got another alert from the Domain controller of NTDS.dit database being exfiltrated. Just one day prior you responded to an alert on the same domain controller where an attacker dumped NTDS.dit via vssadmin utility. However, you managed to delete the dumped files kick the attacker out of the DC, and restore a clean snapshot. Now they again managed to access DC with a domain admin account with their persistent access in the environment. This time they are abusing ntdsutil to dump the database. Help Forela in these chaotic times!!

### Provided Artifacts

A ZIP archive, `CrownJewel2.zip`, containing multiple event log files.

### Task 1

***Question: When utilizing ntdsutil.exe to dump NTDS on disk, it simultaneously employs the Microsoft Shadow Copy Service. What is the most recent timestamp at which this service entered the running state, signifying the possible initiation of the NTDS dumping process?***

This kind of action is stored in the System event log, specifically under event 7036 (a Windows service changed its state).

Let’s open the `System.evtx` file and filter for event 7036.

Then, let’s skim through events from newest to oldest, looking for events related to VSS.

Not long after, the following event can be identified:

![Figure 1](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Make sure to change the time to UTC format (it is shown in your local time zone format by default), or check the Details tab as it contains the value in UTC.

***Answer: 2024-05-15 05:39:&lt;REDACTED&gt;***

### Task 2

***Question: Identify the full path of the dumped NTDS file.***

Let’s use the provided `Application.evtx` file to find events related to dumping the NTDS.

In application event log, event 325 means that the database engine created a new database. So let’s filter for it to check for database dumps.

After filtering, we are left with 4 events, and one of them contains path of dumped NTDS file in a temporary directory:

![Figure 2](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

***Answer: C:\Windows\Temp\&lt;REDACTED&gt;\ntds.dit***

### Task 3

***Question: When was the database dump created on the disk?***

In the same event, the time is clearly mentioned. Make sure to convert it to UTC.

***Answer: 2024-05-15 05:39:&lt;REDACTED&gt;***

### Task 4

***Question: When was the newly dumped database considered complete and ready for use?***

To solve this, let’s filter for event 327, which means that the database engine detached a database.

After filtering, we are left with two events, and one of them points to the NTDS dump:

![Figure 3](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

Make sure to convert the time to UTC.

***Answer: 2024-05-15 05:39:&lt;REDACTED&gt;***

### Task 5

***Question: Event logs use event sources to track events coming from different sources. Which event source provides database status data like creation and detachment?***

The source is clearly mentioned in figures 2 and 3.

***Answer: ES&lt;REDACTED&gt;***

### Task 6

***Question: When ntdsutil.exe is used to dump the database, it enumerates certain user groups to validate the privileges of the account being used. Which two groups are enumerated by the ntdsutil.exe process? Give the groups in alphabetical order joined by comma space.***

Such details are stored in the Security event log, so let’s check its contents out.

By checking the `Security.evtx` file and looking for events that were logged instantly after the NTDS application logs, the following two logs are identified with group names clearly mentioned:

![Figure 4](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

![Figure 5](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

***Answer: Ad&lt;REDACTED&gt;, Ba&lt;REDACTED&gt;***

### Task 7

***Question: Now you are tasked to find the Login Time for the malicious Session. Using the Logon ID, find the Time when the user logon session started.***

For the attacker to successfully dump of NTDS.dit file, he likely used some high account to log into the domain. So let’s filter for security events that involve Kerberos TGTs and STs using event IDs 4768 and 4769.

After doing so, we are left with two consecutive events, with IDs 4768 and 4769, that show Kerberos authentication attempts using administrator account few minutes before the incident:

![Figure 6](/assets/images/writeups/hack-the-box-crownjewel-2/hack-the-box-crownjewel-2-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

Make sure to change the time to UTC.

***Answer: 2024-05-15 05:36:&lt;REDACTED&gt;***

---

## Business Impact

### Confidentiality

- The full NTDS.dit file was exposed, revealing all domain password hashes.
- The attacker can impersonate any domain user.

### Integrity

- With domain admin access, the attacker can alter accounts, groups, or GPOs.
- He may add persistence or change security settings.

### Availability

- The entire compromised domain can be disturbed.

## Remediation

- Rotate all domain admin, service, and user passwords, and reset the krbtgt account twice.
- Isolate the domain controller and remove any dumped files.
- Search for persistence such as new accounts, scheduled tasks, or altered ACLs.
- Monitor and restrict use of ntdsutil and VSS operations.
