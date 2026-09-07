---
title: "Passing the TCM Security PSAA: My Review & Experience"
date: 2026-09-07
summary: "A comprehensive guide and transparent review of passing the TCM Security Practical SOC Analyst Associate (PSAA) on the first attempt. Covers the ticket-based exam format, 48-hour investigation and reporting phases, SOC 101 preparation, artifact triage in Splunk and Wireshark, and reporting tips."
platform: "TCM Security"
type: "Certification Review"
difficulty: "Easy"
link: "https://certifications.tcm-sec.com/psaa/"
tags:
  - blue-team
  - certification-review
  - defensive-security
  - event-logs
  - exam-review
  - incident-response
  - methodology
  - psaa
  - splunk
  - sysreptor
  - tcm-security
  - wireshark
---

![TCM Security Practical SOC Analyst Associate (PSAA) Certificate](/assets/images/exam-reviews/tcm-security-psaa/psaa-certification.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

In April 2025, I passed TCM Security’s **Practical SOC Analyst Associate (PSAA)** exam on my first attempt.

If you are looking to get into security operations and blue teaming, the entry-level certification space is messy. Most popular beginner certifications are either multiple-choice memory drills, way too expensive, or too advanced for a starting point.

The PSAA bridges that gap by working like a realistic, ticket-based SOC shift simulation: two days to triage and investigate realistic incidents, followed by two days to write and submit a professional incident response report.

Below is my breakdown of the certification, its structure and format, how I prepared with TCM’s coursework, how the exam went, and the single biggest mistake I made while writing the report.

## 1. What is the TCM Security PSAA?

The **Practical SOC Analyst Associate (PSAA)** (formerly PJSA) is an entry-to-associate-level practical certification from TCM Security. Instead of testing definitions through multiple-choice questions, it tests your ability to work through realistic Tier 1 / Tier 2 security tickets using standard analyst tools.

```
┌─────────────────────────────────────────────────────────────┐
│                       PSAA Core Domains                     │
├──────────────────────────────┬──────────────────────────────┤
│ • Phishing & Threat Intel    │ • Endpoint Forensic Triage   │
│ • Network Traffic (Wireshark)│ • Event Log Analysis (EVTX)  │
│ • SIEM Analysis (Splunk)     │ • Incident Triage & Reports  │
└──────────────────────────────┴──────────────────────────────┘
```

### Why PSAA Over the Alternatives?

When deciding on a beginner-friendly defensive certification, I looked at multiple common options:

- **Blue Team Level 1 (BTL1):** Great practical material, but significantly more expensive for an entry-level certification.
- **HTB CDSA:** An incredible certification, but far too dense and advanced for someone looking for their first associate-level certification.

TCM Security offered the right balance of price, hands-on practice, and real-world value. With TCM’s 20% university student discount applied, the price-to-value ratio was hard to beat: $199 for 1-year access to the course material plus two exam attempts.

## 2. Exam Structure & Strict Timelines

The PSAA exam runs on a strict **4-day (96-hour) schedule**, cleanly split into two separate phases that control your entire workflow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PSAA Exam Schedule (96 Hours)                      │
├────────────────────────────────────┬────────────────────────────────────┤
│ Phase 1: Investigation (48 Hours)  │ Phase 2: Reporting (48 Hours)      │
│ • Live VM & Ticket access          │ • Lab environment shut down        │
│ • Artifact & evidence collection   │ • Zero endpoint/log access         │
│ • Terminal logging & screenshots   │ • Final document compilation       │
└────────────────────────────────────┴────────────────────────────────────┘
```

- **Phase 1: Investigation Window (Hours 0 to 48):** You get access to the virtual lab environment and the ticket queue. This is your **only** window to run SIEM queries, pull PCAPs, check `.evtx` logs, analyze email headers, and pull indicators of compromise.
- **The Hard Cutoff:** Once the initial 48-hour mark hits, **the lab VM shuts down**. You lose all live access to the remote endpoints, SIEM, and analysis tools.
- **Phase 2: Reporting Window (Hours 48 to 96):** You have 48 more hours dedicated completely to writing and finalizing your incident response report.

Because of the hard cutoff between phases, **you have to collect every piece of evidence during the first two days**. If you get to the reporting phase and realize you forgot an important screenshot, missed a full hash, or skipped the timestamp of a weird logon, you cannot go back into the machines to get it. Treat Phase 1 as an active investigation where your main job is saving and exporting complete evidence for your draft.

## 3. Preparation & Study Workflow

My preparation was simple and direct. I started the prerequisite **Security Operations (SOC) 101** course in February 2025 and took the exam about two months later in April 2025.

### Sticking Strictly to the Coursework

TCM Security says that their SOC 101 course has everything you need to pass the exam, and that was completely true for me. I did not overcomplicate my preparation:

- **Local Lab Setup:** I set up the local virtual Ubuntu analysis machine directly following the course steps.
- **Lab Exercises:** I worked through all the course practical labs and challenges once to get comfortable with the tools.
- **External Labs:** I had previously done some defensive TryHackMe rooms on Wireshark and Splunk, and solved some tasks on BOTS (Boss of the SOC) v1. That said, SOC 101 on its own was completely enough.

### Note-Taking in Notion

I organized my defensive notes inside **Notion**, grouping syntax, filters, and detection indicators by tool and artifact type:

- **Wireshark:** Common display filters (`http.request`, DNS queries, TLS handshakes, payload streams).
- **Splunk:** Core SPL commands (`stats`, `eval`, `table`, index filtering, time boundaries).
- **Windows Event Viewer:** Important Security and System Event IDs (Logon types, Event IDs, service installations).
- **Threat Intel & Mail:** Header fields to check, SPF/DKIM/DMARC checks, and online sandbox environments to use.

## 4. The Exam Experience: Realistic Security Tickets

Unlike offensive exams that require days of grinding, the PSAA investigation phase felt relaxed and well-paced. I spent about **7 to 8 hours per day** during Phase 1, and the time limit was plenty.

### Investigation Scope

You are given a queue of security tickets with minimal initial details, just like an incoming SOC alert queue. The tickets reflect day-to-day security operations work and test your ability to investigate across core defensive realms, such as:

- **Phishing & Threat Intelligence:** Analyzing suspicious emails, parsing raw headers, spotting malicious links or attachments, and validating indicators against external reputation tools.
- **SIEM & Log Triage:** Running search queries in a SIEM environment to correlate events, spot anomalies, and track down attacker actions across log sources.
- **Endpoint & Windows Event Logs:** Checking system artifacts and Windows Event Logs to identify suspicious logons, persistence mechanisms, or unusual process execution.
- **Network Traffic Analysis:** Inspecting packet captures in Wireshark to spot anomalous protocols, plain-text leaks, beaconing behavior, or unauthorized data transfers.

### No Rabbit Holes

The scenarios make sense and stay grounded. There were no tricky rabbit holes or broken files meant to mislead you. If you follow the investigation steps taught in SOC 101, the evidence points right to the root cause.

## 5. The Reporting Phase (And What I'd Do Differently)

Once the 48-hour investigation window closes, the VMs turn off and you switch completely to writing the report.

### The Structure

I followed the official report template provided by TCM Security, documenting my findings across standard incident reporting sections:

- **Ticket Overview:** High-level incident details, timestamps, affected assets, and impacted accounts.
- **Executive Summary:** A clear, non-technical overview explaining what occurred and the overall business impact.
- **Investigation Steps:** A chronological, step-by-step walkthrough of the evidence uncovered during analysis.
- **Identified Indicators of Compromise (IOCs):** Structured lists of malicious IPs, domains, file hashes, and suspicious files.
- **Remediation & Containment:** Practical, actionable steps to contain the incident, remove threats, and improve detection coverage going forward.

### The Mistake: Using Microsoft Word

My biggest mistake during the PSAA exam was using Microsoft Word to create the report.

Fighting Word's formatting layout (fixing shifted tables, broken margins, moved screenshots, and weird spacing) wasted hours of good time. If you want an easier reporting experience, use a Markdown-based tool like **SysReptor** instead of fighting Word.

### Results

I submitted the report and got my passing result back within **3 to 4 days**. The turnaround was quick and smooth.

## 6. Takeaways & Advice

- **Seeing Both Sides:** PSAA showed me the defensive side of cybersecurity and taught me the exact logs, alerts, and network traffic created by attack tools. Knowing how attacks are spotted makes you a much better security practitioner on either side.
- **Trust the Course:** Do not stress about buying extra practice subscriptions or reading outside books. TCM Security's SOC 101 gives you every concept you need to pass.
- **Save Everything in Phase 1:** Keep the hard cutoff in mind. Take screenshots of every search query, full file path, and IOC list before the first 48 hours end.
- **Skip Word for Markdown:** Save yourself the formatting stress. Use a modern reporting tool or a Markdown setup so you can focus entirely on your analysis and notes.

The PSAA is a practical, beginner-friendly, and accessible certification. If you want to prove your hands-on defensive skills without spending a fortune, it is a great choice.
