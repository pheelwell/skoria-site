---
date created: Sunday, March 23rd 2025, 6:24:18 pm
date modified: Sunday, August 31st 2025, 10:11:52 pm
eleventyNavigation:
  key: Dataview Example
layout: base.njk
path: /garden/Meta/Dataview%20Example/
status: tree
title: Dataview Example
type: meta
---

# Dataview Examples

Examples of useful Dataview queries for organizing and finding Skoria content.

## Basic Table Query

```dataview
TABLE ":",type
from "🌐Skoria"
```

## Find Articles by Status

```dataview
TABLE status, type
from "🌐Skoria"
WHERE status
SORT status ASC
```

## Find Articles by Type

```dataview
TABLE status, title
from "🌐Skoria"
WHERE type
SORT type ASC
```

## Find Recent Articles

```dataview
TABLE file.mtime, status
from "🌐Skoria"
SORT file.mtime DESC
LIMIT 10
```

## Find Articles by Owner

```dataview
TABLE status, type
from "🌐Skoria"
WHERE owner
SORT owner ASC
```

## Find Articles with Banners

```dataview
TABLE banner, type
from "🌐Skoria"
WHERE banner
```

## Find Articles by Tags

```dataview
TABLE tags, status
from "🌐Skoria"
WHERE tags
SORT tags ASC
```