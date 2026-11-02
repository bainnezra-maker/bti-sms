#!/usr/bin/env python3
"""Extract the CTVET unit-specification fields used by BIRITECH SMS.

The source documents remain the authority. This script makes a deterministic,
reviewable JSON seed from their repeated Word-document structure.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


def clean(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u2013", "-").replace("\u2014", "-")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" \n\t:-")


def plain_text(path: Path) -> str:
    result = subprocess.run(
        ["pandoc", str(path), "-t", "plain"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.replace("\r\n", "\n")


def section(text: str, start: str, ends: list[str]) -> str:
    start_match = re.search(start, text, re.I | re.M)
    if not start_match:
        return ""
    tail = text[start_match.end() :]
    positions = []
    for end in ends:
        match = re.search(end, tail, re.I | re.M)
        if match:
            positions.append(match.start())
    return clean(tail[: min(positions)] if positions else tail)


def raw_section(text: str, start: str, ends: list[str]) -> str:
    start_match = re.search(start, text, re.I | re.M)
    if not start_match:
        return ""
    tail = text[start_match.end() :]
    positions = []
    for end in ends:
        match = re.search(end, tail, re.I | re.M)
        if match:
            positions.append(match.start())
    return tail[: min(positions)] if positions else tail


def extract_outcomes(text: str) -> list[dict]:
    matches = list(re.finditer(r"^\s*Learning Outcome\s+(\d+)\s*:\s*", text, re.I | re.M))
    outcomes = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end() : end]
        title = section(block, r"^", [r"^\s*Performance Criteria\s*:"])
        # The first summary list can create false positives without PC sections.
        if not re.search(r"^\s*Performance Criteria\s*:", block, re.I | re.M):
            continue
        pc_text = raw_section(
            block,
            r"^\s*Performance Criteria\s*:\s*",
            [r"^\s*Range Statement\s*:", r"^\s*Evidence Requirements\s*:"],
        )
        raw_criteria = re.split(r"(?m)^\s*(?:[a-z][.)]|\([a-z]\))\s+", "\n" + pc_text)
        criteria = [clean(item) for item in raw_criteria if clean(item)]
        range_statement = section(
            block,
            r"^\s*Range Statement\s*:\s*",
            [r"^\s*Evidence Requirements\s*:", r"^\s*CTVET\s*$", r"^\s*LEARNING UNIT SPECIFICATION\s*$"],
        )
        evidence = section(
            block,
            r"^\s*Evidence Requirements\s*:\s*",
            [r"^\s*CTVET\s*$", r"^\s*LEARNING UNIT SPECIFICATION\s*$"],
        )
        outcomes.append(
            {
                "number": int(match.group(1)),
                "title": clean(title),
                "performanceCriteria": criteria,
                "rangeStatement": range_statement,
                "evidenceRequirements": evidence,
            }
        )
    # Unit documents repeat each outcome in later guidance. Keep the detailed copy.
    deduped = {}
    for outcome in outcomes:
        number = outcome["number"]
        if number not in deduped or len(outcome["performanceCriteria"]) > len(deduped[number]["performanceCriteria"]):
            deduped[number] = outcome
    return [deduped[key] for key in sorted(deduped)]


def extract_unit(path: Path, level: str, subject_key: str, unit_number: int) -> dict:
    text = plain_text(path)
    title_match = re.search(r"^\s*Unit Title(?:\s+\d+)?\s*:\s*(.+)$", text, re.I | re.M)
    title = clean(title_match.group(1)) if title_match else path.stem
    title = title.rstrip(".")
    credit_match = re.search(r"^\s*Credit Value\s*:\s*([^\n]*)", text, re.I | re.M)
    hours_match = re.search(r"notional design length for this unit is\s+([0-9.]+)\s+hours", text, re.I)
    level_match = re.search(r"^\s*Level\s*:\s*(.+)$", text, re.I | re.M)
    introduction = section(text, r"^\s*Unit Introduction\s*:\s*", [r"^\s*Learning Outcomes\s*:"])
    content = section(text, r"^CONTENT/CONTEXT\s*:\s*", [r"^DELIVERY APPROACH", r"^ASSESSMENT"])
    assessment = section(text, r"^Assessment procedure\s*:\s*", [r"^Corresponding to Learning Outcome", r"^UNIT SIGN OFF"])
    return {
        "level": level,
        "subjectKey": subject_key,
        "unitNumber": unit_number,
        "unitTitle": title,
        "levelLabel": clean(level_match.group(1)) if level_match else level,
        "creditValue": clean(credit_match.group(1)) if credit_match and clean(credit_match.group(1)) else None,
        "notionalHours": float(hours_match.group(1)) if hours_match else None,
        "introduction": introduction,
        "contentContext": content,
        "assessmentGuidance": assessment,
        "learningOutcomes": extract_outcomes(text),
        "sourceFile": path.name,
    }


def numbered_files(folder: Path, pattern: str) -> list[tuple[int, Path]]:
    rows = []
    for path in folder.glob(pattern):
        match = re.search(r"unit[_ ]+(\d+)", path.name, re.I)
        if match:
            rows.append((int(match.group(1)), path))
    return sorted(rows)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: extract_curriculum.py NCI_FOLDER NCII_ROOT OUTPUT_JSON")
    nci = Path(sys.argv[1])
    ncii = Path(sys.argv[2])
    output = Path(sys.argv[3])
    units = []

    for subject_key, pattern in (("integrated-science", "science_nci_unit_*.docx"), ("social-studies", "social_nci_unit_*.docx")):
        for number, path in numbered_files(nci, pattern):
            units.append(extract_unit(path, "NCI", subject_key, number))

    source_sets = [
        (
            "integrated-science",
            ncii / "SCIENCE/NC II SCIENCE/UNITS SPECIFICATION",
        ),
        (
            "social-studies",
            ncii / "SOCIAL STUDIES/NC II/UNITS SPECIFICATION/WORD DOC",
        ),
    ]
    for subject_key, folder in source_sets:
        for number, path in numbered_files(folder, "*.docx"):
            units.append(extract_unit(path, "NCII", subject_key, number))

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"version": 1, "units": units}, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(units)} units to {output}")


if __name__ == "__main__":
    main()
