---
title: "Hack The Box: Campfire-1"
date: 2025-12-02
summary: "A Very Easy Defensive Lab that centers around analyzing event logs and prefetch files to identify a Kerberoasting attack. The activity starts with Active Directory enumeration using a PowerShell script, followed by the use of a Kerberos-ticket dumping tool to target a domain service account with RC4 encryption. The attack is confirmed through matching timelines in domain controller and workstation logs."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/Campfire-1"
tags:
  - active-directory
  - dfir
  - event-viewer
  - kerberoasting
  - pecmd
  - timeline-explorer
---

### Executive Summary

Analysis of domain controller and workstation logs confirmed a Kerberoasting attempt. The attacker ran an AD enumeration script, bypassed PowerShell restrictions, and used a Kerberos-ticket dumping tool from the workstation. The activity targeted a domain service account using RC4 encryption, which is commonly exploited for offline cracking. The timeline from all logs matched and clearly showed unauthorized AD reconnaissance and credential harvesting attempts.

### Scenario

Alonzo Spotted Weird files on his computer and informed the newly assembled SOC Team. Assessing the situation it is believed a Kerberoasting attack may have occurred in the network. It is your job to confirm the findings by analyzing the provided evidence.

### Provided Artifacts

A zip file, `campfire-1.zip`, containing event logs and prefetch files.

### Task 1

***Question: Analyzing Domain Controller Security Logs, can you confirm the UTC date & time when the kerberoasting activity occurred?***

Let’s unzip the given ZIP file and view the contents of `Triage\Domain Controller\SECURITY-DC.evtx` in the Windows event viewer.

Kerberoasting attacks start by requesting a Kerberos service ticket, and this action is associated with event 4769. Let’s filter for this event ID using the event viewer’s filtering mechanism:

![Figure 1](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

After filtering for this specific ID, 16 events are shown.

Kerberoasting usually targets server accounts in the domain, such as SQL servers, web servers, etc.

Now let’s check the filtered events for those that involve services running on domain servers, instead of those that only target regular machine accounts. By doing so, we can notice this event:

![Figure 2](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

This event shows that Alonzo requested a service ticket for a service account.

The suspicious thing in this event is that the ticket encryption type is `0x17` which represents RC4 encryption. This is the encryption mode preferred by `impacket-getUserSPNs` and other offensive tools used in kerberoasting attacks, because this encryption mode is easier to crack.

These indicators likely suggest that this is the event related to the kerberoasting attack.

By checking the event’s timestamp, which Windows shows in the local time by default, then converting that time to UTC, the answer can be determined.

***Answer: 2024-05-21 03:&lt;REDACTED&gt;***

### Task 2

***Question: What is the Service Name that was targeted?***

In the same event, the Service Name is clearly mentioned.

***Answer: MS&lt;REDACTED&gt;***

### Task 3

***Question: It is really important to identify the Workstation from which this activity occurred. What is the IP Address of the workstation?***

Again in the same event, the IP address of the workstation is mentioned.

***Answer: 172.17.&lt;REDACTED&gt;***

### Task 4

***Question: Now that we have identified the workstation, a triage including PowerShell logs and Prefetch files are provided to you for some deeper insights so we can understand how this activity occurred on the endpoint. What is the name of the file used to Enumerate Active directory objects and possibly find Kerberoastable accounts in the network?***

Let’s check the contents of `Triage\Workstation\Powershell-Operational.evtx` in the event viewer.

By looking at almost any of the Warning events, they include a script path at the end of the event. That script path clearly points to a well-known script used for Active Directory enumeration and exploitation:

![Figure 3](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

***Answer: Pow&lt;REDACTED&gt;***

### Task 5

***Question: When was this script executed? (UTC)***

By ordering the events and arranging the timeline of events, we can notice that the attacker first tried to launch the script but got a PowerShell warning that script running is blocked:

![Figure 4](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Then the attacker reran PowerShell with `-ep bypass` flag which bypasses execution policy:

![Figure 5](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

Then the following Warning event shows the run of the script with the timestamp:

![Figure 6](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

Convert this time to UTC and you’ll get the answer.

***Answer: 2024-05-21 03:&lt;REDACTED&gt;***

### Task 6

***Question: What is the full path of the tool used to perform the actual kerberoasting attack?***

Browsing the events in the evtx file doesn’t show any tools used for the sole purpose of kerberoasting, so let’s check the given prefetch files in `Triage\Workstation\2024-05-21T033012_triage_asset\C\Windows\prefetch`, as they might include useful forensic artifacts.

Let’s use Eric Zimmerman’s `PECmd.exe` prefetch files parser to parse the files into CSV format to make them readable:

```bash
./Pecmd.exe -d "Path\to\Triage\Workstation\2024-05-21T033012_triage_asset\" --csv . --csvf result.csv
```

Then let’s use `TimelineExplorer.exe` by the same author to view the CSV data in an user friendly way.

By checking row number 97, a popular tool used for Kerberos attacks can be identified in the Executable Name column:

![Figure 7](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

To get its full execution path, let’s go to the Files Loaded column which will show all loaded files related to this executable, and one of these files is the executable itself along its full path:

![Figure 8](/assets/images/writeups/hack-the-box-campfire-1/hack-the-box-campfire-1-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

***Answer: C:\Users\Alonzo.spire\Downloads\Ru&lt;REDACTED&gt;***

### Task 7

***Question: When was the tool executed to dump credentials? (UTC)***

By going to the Last Run column in the same row, the exact timestamp can be identified.

***Answer: 2024-05-21 03:&lt;REDACTED&gt;***

---

## Business Impact

### Confidentiality

- Service account credentials could be cracked and misused.
- Sensitive systems linked to that account could be exposed.

### Integrity

- A compromised service account could allow changes to AD objects or system configurations.

### Availability

- Stolen credentials could enable wider attacks that disturb critical services.

## Remediation

- Disable RC4 Kerberos encryption and reset all affected service account passwords.
- Enforce PowerShell logging and restrict script execution to signed scripts only.
- Monitor Event ID 4769 for RC4 usage and unusual SPN targeting.
- Reduce unnecessary service accounts and apply least privilege.
- Ensure EDR blocks known offensive tools and alerts on bypass attempts.
