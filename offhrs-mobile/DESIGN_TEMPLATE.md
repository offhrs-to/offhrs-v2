# Standard Design Template (Home Page)

This document describes the design template used on the Home page. Use it to keep new screens and components consistent.

## Colors

| Token | Hex | Usage |
|-------|-----|--------|
| Sage green | `#5D755D` | Category pills (active), search arrow, accents |
| Light green border | `#A8C4A0` | Card/input/pill borders |
| Hero background | `#E8F0E5` | Green hero/reflection card |
| Cream background | `#FDFCF8` | Page and card background |
| Charcoal | `#2C2C2C` | Primary text |
| Medium gray | `#6B6B6B` | Muted text (e.g. "Welcome") |
| Primary | `#38511B` | Primary CTA, selected tab icon |
| Input background | `#F5F5F5` | Search/input fields |
| Placeholder gray | `#E0E0E0` | Avatar/placeholder circles |

## Layout

- **Screen padding:** `24` horizontal, `48` top, `32` bottom.
- **Logo:** `48×160`, `contentFit="contain"`. When inside padded content, use `marginLeft: -40` so it aligns with other tab pages.
- **Profile placeholder:** `52×52` circle, radius `26`, background `#E0E0E0`.

## Hero Card

- Background: `#E8F0E5`, border radius `18`, `marginTop: 6`, `paddingBottom: 20`.
- Title: charcoal, bold, serif, center, `marginTop: 24`, `marginBottom: 12`.
- Subtitle: charcoal, italic, serif, center, `fontSize: 27`, `marginBottom: 36`.
- Search bar: pill (`borderRadius: 9999`), `#F5F5F5` bg, `#A8C4A0` border, `marginHorizontal: 20`, `paddingVertical: 9`, `paddingHorizontal: 12`, `fontSize: 12`.

## Section Title

- Charcoal, bold, serif, `fontSize: 15`, `marginTop: 24`, `marginBottom: 24`.

## Category Pills (2 per row)

- Width: `(screenWidth - 24*2 - 12) / 2`.
- Height: `68`, padding H `20` V `12`, `borderRadius: 9999`.
- Inactive: cream bg, sage green border, sage green text.
- Active: sage green bg, white text.
- Gap: `12`. Text: center, `alignSelf: 'stretch'` for wrap (e.g. "Scent & Candle").

## Primary CTA (e.g. Browse Workshops)

- Full width (`alignSelf: 'stretch'`), `paddingVertical: 12`, `paddingHorizontal: 24`.
- Background and border: `#38511B`, text: white.
- `borderRadius: 9999`. Optionally wrapped in `View` with `flex: 1, justifyContent: 'center'` to center vertically in remaining space.

## Usage

Import tokens from `@/constants/design-template`:

```ts
import { DesignColors, DesignSpacing, DesignSizes, getCategoryButtonWidth } from '@/constants/design-template';
```
