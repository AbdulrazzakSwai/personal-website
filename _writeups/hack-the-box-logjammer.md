---
title: "Hack The Box: LogJammer"
date: 2025-12-02
summary: "An Easy Windows-based defensive lab analyzing event log artifacts to investigate suspicious host-based activity performed by an insider user. Cross-referencing Security, Firewall, PowerShell, Defender, and System logs reconstructs a timeline covering initial logon, outbound firewall tampering, audit policy modification, scheduled task persistence, Execution of an Active Directory enumeration tool flagged and quarantined by Defender, and log clearing attempts."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Easy"
link: "https://app.hackthebox.com/sherlocks/LogJammer"
tags:
  - active-directory
  - dfir
  - event-viewer
  - firewall-altering
  - scheduled-tasks
---

### Executive Summary

Review of the provided Windows event logs confirmed that the user Cyberjunkie performed several suspicious and unauthorized actions. These included logging in, adding a malicious firewall rule, modifying audit policies, creating a scheduled task, executing Powershell commands, and running tools flagged as malware. The user also cleared event logs to hide activity. The timeline and evidence across Security, Firewall, Powershell, Defender, and System logs consistently show intentional misuse of the workstation.

### Scenario

You have been presented with the opportunity to work as a junior DFIR consultant for a big consultancy. However, they have provided a technical assessment for you to complete. The consultancy Forela-Security would like to gauge your Windows Event Log Analysis knowledge. We believe the Cyberjunkie user logged in to his computer and may have taken malicious actions. Please analyze the given event logs and report back. 

### Provided Artifacts

A ZIP archive, `logjammer.zip`, containing multiple event log files.

### Task 1

***Question: When did the cyberjunkie user first successfully log into his computer? (UTC)***

Login events are usually stored in the Security event file, so let’s open `logjammer\Event-Logs\Security.evtx` using Windows event viewer. The file contains 115 events.

Successful logins are associated with event 4624, so let’s filter for this event from the filtering option on the right of the screen.

After filtering for this event ID, we are left with 67 events.

By ordering them by time and skimming through them, one of them shows a successful login by use Cyberjunkie:

![Figure 1](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Make sure to convert the timestamp to UTC as Windows shows it in your local time zone by default.

***Answer: 27/03/2023 14:&lt;REDACTED&gt;***

### Task 2

***Question: The user tampered with firewall settings on the system. Analyze the firewall event logs to find out the Name of the firewall rule added?***

This kind of events should be stored in the `Windows Firewall-Firewall.evtx` file, so let’s check its contents out.

The event ID for a firewall rule added is 2004, so let’s filter for it from the menu options.

After doing so and skimming through events, the rule name in the first event is very suspicious as it mentions `metasploit` which is an offensive framework used in red teaming actions:

![Figure 2](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

***Answer: Metasploit &lt;REDACTED&gt;***

### Task 3

***Question: Whats the direction of the firewall rule?***

The answer is in the same event, in the Direction field.

***Answer: Ou&lt;REDACTED&gt;***

### Task 4

***Question: The user changed audit policy of the computer. Whats the Subcategory of this changed policy?***

Audit policy changes are recorded in Security event files, so let’s return back to the `Security.evtx` file.

The event ID associated with this type of actions is 4719, so let’s filter for it.

After filtering, only one event is shows, and the subcategory is clearly mentioned:

![Figure 3](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

***Answer: Other &lt;REDACTED&gt;***

### Task 5

***Question: The user "cyberjunkie" created a scheduled task. Whats the name of this task?***

Events related to scheduled tasks are recorded in Security event file under ID 4698, so let’s filter for it.

By doing so, only one event is shown, and the name of the scheduled task is clearly shown:

![Figure 4](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

***Answer: HTB-&lt;REDACTED&gt;***

### Task 6

***Question: Whats the full path of the file which was scheduled for the task?***

By scrolling down into the details of this event, the path is mentioned:

![Figure 5](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

***Answer: C:\Users\CyberJunkie\Desktop\Au&lt;REDACTED&gt;***

### Task 7

***Question: What are the arguments of the command?***

Figure 5 clearly shows the arguments in the Arguments field.

***Answer: -A cyb&lt;REDACTED&gt;***

### Task 8

***Question: The antivirus running on the system identified a threat and performed actions on it. Which tool was identified as malware by antivirus?*** 

Malware-related events are stored in `Windows Defender-Operational.evtx`, so let’s open it and check out its contents.

Threat detection and action events are associated with event 1116, so let’s filter for it.

After doing so, and after skimming through details of the top event, a popular Active Directory enumeration tool is clearly mentioned in the details of the event:

![Figure 6](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

***Answer: Sha&lt;REDACTED&gt;***

### Task 9

***Question: Whats the full path of the malware which raised the alert?***

Figure 6 clearly shows the full path of the malware.

***Answer: C:\Users\CyberJunkie\Downloads\Sha&lt;REDACTED&gt;***

### Task 10

***Question: What action was taken by the antivirus?***

Events related to Actions Taken by the antivirus are associated with event 1117, so let’s filter for it.

After doing so, and in the same timeframe of the malware detection event, an event related to action taken on the malware can be identified:

![Figure 7](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

***Answer: Qu&lt;REDACTED&gt;***

### Task 11

***Question: The user used Powershell to execute commands. What command was executed by the user?***

This type of information is likely stored in `Powershell-Operational.evtx`, so let’s open it.

Powershell command execution events are associated with the ID 4104, so let’s filter for it.

After doing so and skimming through top events, the following unusual command is identified:

![Figure 8](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

***Answer: Get-FileHash &lt;REDACTED&gt;***

### Task 12

***Question: We suspect the user deleted some event logs. Which Event log file was cleared?***

Event log clearing events are associated with Security event ID 1102 and System event ID 104.

The challenge isn’t looking for the Security one, so let’s open the System event file and filter for event 104.

After doing so, 15 events are shown. All of them point to the deletion of Sysmon log file except one:

![Figure 9](/assets/images/writeups/hack-the-box-logjammer/hack-the-box-logjammer-fig-10.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

***Answer: Microsoft-&lt;REDACTED&gt;***

---

## Business Impact

### Confidentiality

- Malware and enumeration tools could collect sensitive data.
- Scheduled tasks and altered firewall rules could enable external access or data exfiltration.

### Integrity

- Audit policy changes and event log deletion indicate attempts to tamper with system monitoring.
- Malicious scripts and scheduled tasks may modify files or system settings.

### Availability

- Misuse of system privileges and malware execution may lead to instability or system downtime.
- Improper firewall modifications can disturb normal communication or expose services.

## Remediation

- Reset the user’s credentials.
- Restore default audit and firewall policies through Group Policy.
- Remove unauthorized scheduled tasks and malicious files.
- Strengthen endpoint detection with stricter Powershell logging, application control, and alerting for log-clearing events.
- Perform a full review of the user’s activity to ensure no persistence mechanisms remain.
