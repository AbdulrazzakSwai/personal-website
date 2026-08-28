---
title: "Passing the HTB CPTS on the First Attempt: The Complete Blueprint & 10-Day Exam Experience"
date: 2026-08-26
summary: "A comprehensive guide and transparent day-by-day walkthrough of passing the Hack The Box Certified Penetration Testing Specialist (CPTS) on the first attempt with 85 points. Covers preparation strategy across two passes of HTB Academy, pivoting with Ligolo-ng, active directory enumeration, note-taking architecture, and commercial-grade reporting under pressure."
platform: "Hack The Box"
type: "Exam Review"
difficulty: "Medium"
link: "https://academy.hackthebox.com/preview/certifications/htb-certified-penetration-testing-specialist"
tags:
  - active-directory
  - cpts
  - exam-review
  - htb
  - htb-academy
  - ligolo-ng
  - methodology
  - penetration-testing
  - pivoting
  - sysreptor
---

![HTB Certified Penetration Testing Specialist (CPTS) Certificate](/assets/images/exam-reviews/hack-the-box-cpts/cpts-certification.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

In July 2026, I sat for and passed the **Hack The Box Certified Penetration Testing Specialist (CPTS)** exam on my very first attempt.

After spending 10 consecutive days engaged in deep enterprise reconnaissance, chaining multi-stage exploits, double pivoting through segmented networks, and drafting a 134-page commercial-grade report, I secured **85 points (12/14 flags)** and submitted my final report with just two minutes left on the clock.

The CPTS is widely regarded as one of the most grueling, realistic, and rewarding practical security certifications in the industry. In this guide, I break down everything you need to know about the certification: what it is, how it compares to other popular certifications like the OSCP, how I structured my preparation for the exam, my exact note-taking and lab strategy, and a day-by-day walkthrough of my 10-day exam marathon without violating the NDA.

## 1. What is HTB CPTS?

The **Hack The Box (HTB) Certified Penetration Testing Specialist (CPTS)** is an intermediate-level practical certification issued by Hack The Box. It evaluates an individual's technical capability to execute an end-to-end black-box penetration test against a corporate network and communicate risk through a formal, executive-ready assessment report.

```
┌─────────────────────────────────────────────────────────────┐
│                      HTB CPTS Domains                       │
├──────────────────────────────┬──────────────────────────────┤
│ • External & Internal Recon  │ • Linux/Windows PrivEsc      │
│ • Web Application Attacks    │ • Pivoting & Tunneling       │
│ • Active Directory Attacks   │ • Post-Exploitation Looting  │
│ • Lateral Movement           │ • Commercial Report Writing  │
└──────────────────────────────┴──────────────────────────────┘
```

### Why Choose CPTS Over OSCP?

For years, the standard default for breaking into offensive security has been the OSCP. However, **in my opinion**, CPTS delivers a substantially more modern, realistic, and cost-effective learning path:

| **Factor** | **HTB CPTS** | **OffSec OSCP / OSCP+** |
| --- | --- | --- |
| **Exam Duration** | **10 Days** (Exploitation + Reporting) | **24 Hours** (Exploitation) + 24 Hours (Report) |
| **Format** | Multi-domain enterprise simulation | Standalone hosts + small Active Directory set |
| **Material Access** | **Keep the 28 modules forever** (Tier-unlocked) | Time-limited lab access (subscription-dependent) |
| **Cost** | $210 (voucher includes 2 attempts) + as low as ~$40 for the 28 Academy modules (via Student Plan at $8/mo) | ~$1,700+ (Course + 2 attempts package) |
| **Realism** | Mimics a real-world multi-day client engagement | Time-pressured speedrun |

The single biggest advantage of HTB Academy is ownership: once you unlock and complete the **Penetration Tester Job Role Path** (28 modules), the material, interactive cheatsheets, and command breakdowns remain accessible on your account permanently.

## 2. Exam Structure & Real-World Realism

The CPTS exam does not feature multiple-choice questions or isolated "CTF-style" tasks.

- **Prerequisite:** 100% completion of the 28 modules comprising the *Penetration Tester* path on HTB Academy.
- **Timeframe:** **10 days (240 hours)** from the moment you initialize the exam environment. This 10-day window covers both active network exploitation and final report submission.
- **Pass Requirements:**
    1. Score at least **85 out of 100 points** (capture a minimum of **12 out of 14 flags**).
    2. Submit a commercial-grade, professional penetration testing report covering executive summaries, vulnerability risk ratings, detailed technical walkthroughs, and actionable remediations.
- **Environment Architecture:** A black-box enterprise environment leading into interconnected corporate domains. You will encounter Windows and Linux hosts, Active Directory forests, web applications, and custom services. Multi-hop pivoting is the standard reality once you breach the internal Active Directory environment.

## 3. My Preparation: HTB Academy Deep Dive

I started the Penetration Tester path in **November 2024** and finished all 28 modules by **September 2025**. However, I didn't schedule my exam attempt until **July 2026,** almost 10 months later.

Like many candidates, I suffered from heavy imposter syndrome and self-doubt. Looking back, delaying that long was unnecessary. If you understand the core mechanics of the path, you are ready.

### The "Two-Pass" Learning Approach

Rather than rushing through the path to reach 100%, I completed the entire 28-module curriculum **twice**:

- **Pass 1: Broad Understanding & Flow**  
  *Focus:* Big-picture mechanics, understanding how modules connect, and finishing hands-on skills assessments.
- **Pass 2: Granular Mastery & Cheatsheet Creation**  
  *Focus:* Building a methodology, mapping out common mistakes and fixes, and organizing searchable cheatsheets.

### Note-Taking Architecture (Notion)

Speed during the exam depends entirely on quick information retrieval. I used a strict hierarchical structure in **Notion** and leveraged the built-in search feature:

```
[Offensive Security Master Database]
 ├── 01. Reconnaissance & Discovery
 │    ├── Port Scanning, Service Fingerprinting, DNS Enumeration
 │    └── Subdomain & Directory Fuzzing Playbooks
 ├── 02. Web Application Exploitation
 │    ├── File Inclusion (LFI/RFI) & Log Poisoning
 │    ├── File Upload Bypass Techniques
 │    ├── SQL Injection (Manual + SQLMap workflows)
 │    └── CMS-Specific Exploitation (WordPress, Joomla, Drupal)
 ├── 03. Network Pivoting & Tunneling
 │    ├── Ligolo-ng Setup, Dynamic Routing, Multi-Hop Chains
 │    └── Static Binaries & File Transfer Workflows
 ├── 04. Privilege Escalation
 │    ├── Linux (SUID, Capabilities, Cron, Sudo, Kernel)
 │    └── Windows (Token Impersonation, Unquoted Paths, Services, DPAPI)
 ├── 05. Active Directory Attacks
 │    ├── Kerberoasting, AS-REP Roasting, BloodHound Analysis
 │    ├── ACL Abuse, GPO Modification, Domain Trust Hopping
 │    └── DCSync & Golden Ticket Persistence
 └── 06. Post-Exploitation & Reporting
      ├── Credential Hunting & Decryption Scripts
      └── Findings Template & CVSS 3.1 Matrices
```

### Attack Infrastructure & Tooling

- **Attack Platform:** Kali Linux running inside VirtualBox.
- **Pivoting Tool:** **Ligolo-ng** exclusively. While the Academy course teaches multiple pivoting utilities (Chisel, SSH dynamic tunneling, proxychains), Ligolo-ng provides simple interface-level routing, drastically speeding up multi-subnet Nmap sweeps.

## 4. External Preparation (Beyond the Academy)

While the Academy path provides the theoretical foundation, practical muscle memory requires extensive lab practicing:

- **HTB Labs CPTS Preparation Track:** This track is **mandatory** in my opinion. Solving the machines in this official track builds the exact mindset needed to chain vulnerabilities across diverse attack vectors. *(In fact, a critical breakthrough during my exam came directly from remembering a technique featured in this track).*
- **Retired HTB Machines:** Solved ~100 HTB boxes across varying difficulty ratings (Easy, Medium, and Hard) focusing on realistic corporate attack chains.
- **CTF Foundations:** Active participant on TryHackMe and Hack The Box since June 2024.
- **Active Directory Home Labs:** Prior to taking the exam, I had built 3 multi-domain Active Directory home labs for personal research, which helped me gain a deeper understanding of Active Directory attacks and how to exploit them in a real-world scenario.

I did **not** complete any HTB ProLabs or follow the TJNull/IppSec lists specifically; the combination of the Academy path, the CPTS preparation track, and independent box practice was more than sufficient.

## 5. The 10-Day Exam Experience: Day-by-Day Breakdown

Treat the CPTS exam like a full-time engineering sprint. I dedicated a minimum of **10 to 12 hours every single day** to the exam environment. Attempting to balance this exam alongside a full-time work schedule is a recipe for exhaustion.

### Days 1 to 2.5: The Initial Wall of Silence

The first two days were pure reconnaissance. When you are dropped into a massive black-box environment with multiple web properties and open ports, the sheer attack surface is overwhelming. I spent 60+ hours systematically port scanning, fuzzing virtual hosts, identifying hidden webpages, and mapping possible attack paths without capturing a single flag.

### Day 3: The Foothold (Flag 1)

On Day 3, my thorough enumeration paid off. An obscure finding on an exposed service allowed me to construct an initial exploit chain, finally breaking through and unlocking **Flag 1**.

### Days 4 to 6: Momentum (Flags 2 through 7)

Once inside, momentum picked up. I established my tunnels and began moving laterally through the network. I secured 1 to 2 flags each day by combining host privilege escalation, credential dumping, and exploiting internal applications.

### Day 7 (End) to Day 8: The Brutal Wall on Flag 8

At the end of Day 7, I ran into a dead end attempting to reach Flag 8. For the entirety of **Day 8 (24+ hours)**, I made **zero progress**. Every payload failed, every fuzzing wordlist returned empty, and fatigue began setting in.

### Day 9: The Breakthrough & The 85-Point Sweep

On Day 9, I took a step back, reviewed my raw notes, and recalled a specific edge-case exploitation technique I had practiced months prior on a machine in the **HTB Labs CPTS Preparation Track**.

I tested the technique, and I was back in business.

Breaking through Flag 8 unlocked the remainder of the domain path:

- **Morning:** Flag 8 captured.
- **Afternoon:** Flags 10 and 11 secured.
- **Evening:** Flag 12 captured, bringing my score to **85 points (12/14 flags),** which is the required threshold to pass.

With the clock ticking down and only one day left, I stopped active exploitation to focus 100% of my remaining energy on the report.

## 6. Report Writing & The Near-Catastrophe

The CPTS exam requires a **commercial-grade, client-deliverable report**. You cannot pass on flag points alone; a substandard report results in a failure regardless of whether you have 85 or 100 points.

### My Documentation Workflow

1. **Live Logging with Tmux:** From Day 1, every terminal command and stdout response was captured using Tmux's scrollback history buffers.
2. **SysReptor:** I used **SysReptor** instead of Microsoft Word or LibreOffice. SysReptor allowed me to write findings in native Markdown, auto-calculate CVSS risk matrices, and render a beautifully styled corporate PDF. Attempting to format a 130+ page technical document in Microsoft Word under exam pressure would have cost hours of layout troubleshooting.
3. **Drafting on the Fly:** I drafted individual findings and captured clean screenshots the moment an exploit succeeded. **Do not leave writing and formatting your report to the final hours!**

### The 5-Minute Panic

With barely 10 minutes remaining before the 240-hour exam portal closed, I attempted to compile my final 134-page report in SysReptor.

**The rendering engine threw a fatal template parsing error.**

Looking back, those next few minutes were easily some of the most stressful moments of my life. Adrenaline was surging as I scrambled to hunt down the broken Markdown syntax: an unescaped character buried deep inside a code block. With the clock aggressively ticking down and SysReptor refusing to compile the updated file, I couldn't risk debugging any longer.

Luckily, I had followed my own rule of keeping backup drafts. I had exported an earlier PDF draft. It wasn't 100% perfected with my latest formatting polish, but it contained the crucial findings, reproduction steps, and evidences.

I grabbed that saved draft and uploaded it to the HTB portal. The submission went through with just **2 minutes left on the clock**.

### Assessor Feedback

A few days later, I received the official confirmation email:

> *"We found your report to be exceptionally polished and well-presented... Your report was precise, professional, and highly effective."*

## 7. Golden Rules, Tips & Recommendations

If you are planning to sit the CPTS exam, keep these rules at the core of your strategy:

### 1. Document Everything in Real Time

Do not treat reporting as a separate phase that happens on Day 10. Record commands, raw outputs, and clean step-by-step screenshots the second you land a shell. The CPTS report requires an end-to-end technical walkthrough section; building it retroactively from memory is nearly impossible.

### 2. Use SysReptor & Export Local PDF Drafts Constantly

SysReptor will save you hours of formatting friction compared to Word. However, **export and save draft PDF copies locally multiple times a day**. If the rendering engine crashes or an asset breaks near the deadline, you must have a recent, backup functional PDF copy ready to submit.

### 3. Complete the HTB Labs CPTS Preparation Track

The modules teach you the theory with decent practice; the CPTS Prep track on HTB Labs teaches you the intuition. Do not skip this track.

### 4. Master Pivoting Before Starting

Ensure you can configure tun interfaces, handle multi-subnet routes, and establish reverse agents cleanly. Fast, reliable pivoting is the backbone of your lateral movement.

### 5. Clear Your Schedule

Do not try to balance the exam with work, travel, or heavy commitments. The environment requires deep, uninterrupted focus. Treat the 10 days like an intensive engagement.

### 6. Reject the "Fail the First Attempt" Myth

You will often see advice suggesting you treat your first attempt merely as a "reconnaissance run" and expect to use the free retake. **Do not adopt this mindset.** If you have mastered the Academy modules and practice boxes, you have every skill required to pass on your first attempt.

## Conclusion

The HTB Certified Penetration Testing Specialist is a demanding, mentally taxing, and incredibly comprehensive exam. It tests not only your offensive technical capabilities, but also your operational endurance, enumeration discipline, and ability to communicate business risk.

If you're hesitating to take it: trust your preparation, build a rock-solid methodology, document as you go, and keep pushing forward.
