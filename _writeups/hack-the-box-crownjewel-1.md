---
title: "Hack The Box: CrownJewel-1"
date: 2025-12-03
summary: "A Very Easy Windows-based defensive lab analyzing event logs and MFT artifacts to investigate an unauthorized Volume Shadow Copy manipulation on a Domain Controller. Analysis of System, Security, and NTFS logs reveals the exact execution time, process ID, and mounted Volume GUID associated with vssadmin usage, while MFT parsing via MFTECmd pinpoints the exfiltrated NTDS.dit database and SYSTEM registry hive paths and timestamps."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Windows"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/CrownJewel-1"
tags:
  - active-directory
  - dfir
  - event-viewer
  - mftecmd
  - ntds-dit
  - shadow-copy
  - timeline-explorer
---

### Executive Summary

Reviewing the event logs and the MFT shows that the Volume Shadow Copy service was started on the domain controller when it normally should not be. This suggests someone used vssadmin for malicious purposes. Right after the service started, the system account began checking privileged user groups, which is expected when a shadow copy is created. NTFS logs then show that a shadow copy was mounted, and the MFT confirms that the attacker dumped the NTDS.dit file and a registry hive into a user folder. All timestamps line up, clearly showing that sensitive domain data was extracted without authorization.

### Scenario

Forela's domain controller is under attack. The Domain Administrator account is believed to be compromised, and it is suspected that the threat actor dumped the NTDS.dit database on the DC. We just received an alert of vssadmin being used on the DC, since this is not part of the routine schedule we have good reason to believe that the attacker abused this LOLBIN utility to get the Domain environment's crown jewel. Perform some analysis on provided artifacts for a quick triage and if possible kick the attacker as early as possible.

### Provided Artifacts

A ZIP archive, `CrownJewel1.zip`, containing multiple event log files and an MFT file.

### Task 1

***Question: Attackers can abuse the vssadmin utility to create volume shadow snapshots and then extract sensitive files like NTDS.dit to bypass security mechanisms. Identify the time when the Volume Shadow Copy service entered a running state.***

This kind of action is stored in the System event log, specifically under event 7036 (a Windows service changed its state).

So, let’s open the provided `System.evtx` file and filter for event 7036 from the menu option on the right.

After doing so, and after skimming through the filtered events, there is one event mentioning the start of Volume Shadow Copy service:

![Figure 1](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-2.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

Make sure to change the timestamp to UTC (Windows shows it in your time zone by default).

***Answer: 2024-05-14 03:&lt;REDACTED&gt;***

### Task 2

***Question: When a volume shadow snapshot is created, the Volume shadow copy service validates the privileges using the Machine account and enumerates User groups. Find the two user groups the volume shadow copy process queries and the machine account that did it.***

Such details are stored in the Security event log, so let’s check it out.

By navigating to the events that occurred instantly after the run of the VSS service, we can identify these two events:

![Figure 2](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-3.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

![Figure 3](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-4.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

The events clearly mention the associated groups and account name.

***Answer: Ad&lt;REDACTED&gt;, Ba&lt;REDACTED&gt;, DC&lt;REDACTED&gt;***

### Task 3

***Question: Identify the Process ID (in Decimal) of the volume shadow copy service process.***

In any of the events used in question 2, if you go to the Details tab of the event, the CallerProcessId field will show the process ID in hex:

![Figure 4](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-5.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

Convert this value to decimal and you’ll get the answer.

***Answer: 44&lt;REDACTED&gt;***

### Task 4

***Question: Find the assigned Volume ID/GUID value to the Shadow copy snapshot when it was mounted.***

Mounting events are likely stored in the NTFS event log, so let’s open `Microsoft-Windows-NTFS.evtx` and check its contents out.

The event logged instantly after the timestamp of the previously identified events (in other event log files) shows the following:

![Figure 5](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-6.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

By checking its Details tab, the GUID is clearly mentioned:

![Figure 6](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-7.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

***Answer: {06c4a997&lt;REDACTED&gt;}***

### Task 5

***Question: Identify the full path of the dumped NTDS database on disk.***

For this task, let’s switch into parsing the provided MFT file using Eric Zimmerman’s `MFTECmd.exe` MFT parser:

```bash
.\MFTECmd.exe -f "Path\to\$MFT" --csv .
```

After parsing the data, let’s load the CSV file into `TimelineExplorer.exe` to view the data in a user-friendly way.

After loading the CSV file, let’s search for the word “ntds.dit” using the search feature:

![Figure 7](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-8.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

The path of the dumped file is clearly shown in the filtered output.

***Answer: C:\Users\Adm&lt;REDACTED&gt;\Ntds.dit***

### Task 6

***Question: When was newly dumped ntds.dit created on disk?***

In the same row, there is a column titled Created0x10 which shows when the dump was created.

***Answer: 2024-05-14 03:&lt;REDACTED&gt;***

### Task 7

***Question: A registry hive was also dumped alongside the NTDS database. Which registry hive was dumped and what is its file size in bytes?***

Since this hive was dumped alongside the NTDS, let’s filter for rows that share the same Parent Entry Number as the NTDS data row, which is 42:

![Figure 8](/assets/images/writeups/hack-the-box-crownjewel-1/hack-the-box-crownjewel-1-fig-9.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

As seen, there is one entry which shows the name of a registry hive, with its size.

***Answer: SY&lt;REDACTED&gt;, 175&lt;REDACTED&gt;***

---

## Business Impact

### Confidentiality

- The NTDS.dit dump exposes all domain password hashes and authentication data.
- The dumped registry hive, combined with NTDS, allows full credential compromise.
- The attacker can authenticate as any user, including domain administrators.

### Integrity

- Full domain compromise enables attackers to modify AD objects, policies, and group memberships.
- Attackers can implement persistence mechanisms or tamper with security settings.

### Availability

- With administrative control, an attacker can disable services, delete objects, or disrupt domain-wide authentication.
- Recovery may require password resets domain-wide and rebuilding critical systems.

## Remediation

- Immediately reset the krbtgt account twice and rotate all privileged and service account passwords.
- Remove any dumped data from the system and isolate the domain controller for further review.
- Revoke any persistence mechanisms, scheduled tasks, or rogue accounts.
- Enforce strict monitoring and alerting for vssadmin, shadow copy creation, and NTFS mount events.
- Apply Group Policy restrictions to block unauthorized use of VSS-related utilities.
- Review all machine accounts and domain admin activity within the same timeframe.
