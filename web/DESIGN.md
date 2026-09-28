---
name: Project Lemonade — Package E recipient surface
description: Read-only sharing in the approved Synthetic Editorial identity.
colors:
  field-light: "#f4f6f1"
  ink-light: "#080a08"
  muted-light: "#535c56"
  line-light: "#bac2bc"
  brand-light: "#304700"
  action-light: "#234dc7"
  on-action-light: "#fff"
  acid: "#baff24"
  field-dark: "#050806"
  ink-dark: "#f5f7f1"
  muted-dark: "#adb7af"
  line-dark: "#3d4b42"
  brand-dark: "#baff24"
  action-dark: "#91a9ff"
  on-action-dark: "#050806"
typography:
  display:
    fontFamily: "Barlow, sans-serif"
    fontSize: "clamp(2.7rem, 6vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.05
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
rounded:
  action: "4px"
---

# Design System: Package E recipient surface

## Overview

**Creative North Star: "Synthetic Editorial"**

This scoped record describes the built recipient page and sharing help; the root design authority remains unchanged. Read mode serves recipients who scan places in the owner's order, then open a map. Bold condensed headings, quiet reading space and ruled rows preserve the established identity.

## Colors

The frontmatter records exact light and dark tokens from `sharing.css`. Field, ink, muted and line form the neutral reading surface. Brand identifies Lemonade; action colors mark links, outlined controls and focus. Acid supplies selection color and the dark brand. Dark mode follows the system preference. Selection retains dark ink on acid in either mode.

## Typography

Local `BarlowCondensed-Bold.ttf` is registered as Barlow (700), with font swapping. It carries the brand, main title, numbered rows and supporting editorial heading. System sans-serif carries body copy and place names. The title is limited to 20 characters per line; explanatory copy to 65 characters. Titles and supplied names/locations can break long strings.

## Layout

One ordered, ruled list sits within a centered container capped at 68rem, with 1.5rem outer gutters. Desktop rows align number, details and map action. At 600px and below, gutters become 1rem, the heading stacks, and map actions move beneath details in the second column. Masthead, footer and footer navigation use flex wrapping to accommodate narrow layouts and large text. The list preserves source order; absent locations or map links leave no empty control.

## Elevation & Depth

The surface is flat, without shadows, gradients or animated transitions. Spacing and thin rules establish hierarchy.

## Shapes

Rows use straight horizontal rules. Outlined actions have restrained corners matching the action radius token; no card grid or decorative container surrounds each place.

## Components

- **Reading header:** two-line brand and explicit read-only label; title, status and refresh precede the list.
- **Actions:** refresh and map links have a 48px minimum height. Hover fills with the action color and uses on-action text; loading disables refresh. Footer links also meet the 48px height. Keyboard focus is a 3px action-colored outline offset by 5px; a focus-revealed skip control moves focus to main. Forced-colors mode preserves control borders. Touch actions require no hover discovery.
- **States:** polite live status communicates opening, count/order, empty shortlist, unavailable link, busy service, connection failure, unconfigured sharing and a browser session unable to check freshness. Refresh checks again; hidden/restored pages clear and recheck content. No skeleton or animation substitutes for these messages.
- **Boundaries:** the page displays the public title, ordered public names, optional locations and allowed Google Maps links. It offers no editing or account requirement. Map links open a new tab. Help explains sender-authored details, forwarding, revocation limits and that private notes, visit history and account details are not automatically included.

## Do's and Don'ts

Do preserve readable order, visible focus, text wrapping, light/dark parity and clear recovery copy. Do keep the recipient view within this established identity. Don't imply that Lemonade verifies destinations or can erase screenshots and forwarded copies.
