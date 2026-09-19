# Chatbot Analytics

Your analytics dashboard shows how your chats, flows, broadcasts, and revenue are doing, all on one screen. Find it under **Dashboard** in the main menu.

## Date range and channel filter

At the top you can switch between the last 7, 30, or 90 days, and filter everything to a single channel (Messenger, Instagram, WhatsApp, SMS, or Web chat). All channels is the default.

## The headline numbers

- **Messages sent**: everything your workspace sent out, with read and click rates underneath.
- **Messages received**: inbound messages plus how many new conversations started.
- **Subscriber growth**: new subscribers minus people who left. A new contact counts as a subscriber the first time they message you.
- **Revenue earned**: money tagged with the log revenue flow action, with the all-time total underneath.
- **Click rate**: taps on buttons, links, and quick replies divided by messages sent.
- **Broadcasts sent**: one-time broadcasts and campaigns, with any failures called out.
- **Unanswered chats**: inbound messages that got no reply within 15 minutes. Lower is better.
- **Human takeover**: how often a person took over from the bot, and how fast the first human reply landed on average.

## Messages over time

Sent vs received per day. Spikes here usually line up with a broadcast going out or a flow going live.

## Chats by channel

Where your conversations actually live. If one channel dominates, that is where your next flow should go.

## Flow funnels

For each flow: how many people entered, how each step performed, where people dropped off, and what the flow earned.

- **Entered** counts every run that started the flow.
- Each **step** shows how many people reached it. The red percentage next to a step is the drop-off from the entry count, so you can spot the step where people give up.
- **Completed** counts runs that reached the end.
- If revenue was tagged inside the flow, you see "This flow earned $X" right on the card.

## Message performance

Sent, delivered, read, and clicked totals. What each channel can report back differs: WhatsApp reports delivery and reads, Messenger and Instagram report reads, SMS reports sends. If delivered or read is low for a channel, that is a reporting limit, not a bug.

## Subscriber growth

Net subscriber growth per day: people joining minus people leaving. SMS STOP replies and similar opt-outs count as leaving.

## Broadcast and campaign reports

One row per campaign: sent, failed, delivered, read, clicked, unsubscribes, and attributed revenue. Use it to compare subject lines, send times, and audiences.

## Revenue

The most recent money logged, each entry labeled as logged manually or from a flow. To make revenue show up here, add the **log revenue** flow action wherever a booking or sale happens and tag it with a dollar value. Pass a flow name or campaign name with the entry and it gets attributed, so the funnel and campaign cards can say "this flow earned $X".

## Simulator traffic

Runs from the flow preview simulator are tracked too, but kept completely separate. Tick **Show simulator** at the top to see a small banner with your test traffic. It never touches the live numbers.

## How the numbers stay cheap

Analytics are stored as small daily counters per workspace, not as one record per message. That keeps the dashboard fast and your costs low. Nothing here slows down sending or receiving messages: tracking runs in the background and never blocks a chat.
