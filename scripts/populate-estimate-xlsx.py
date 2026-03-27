#!/usr/bin/env python3
"""
Populate the QED42 Estimation Template Backend tab from an optimistic estimate markdown file.

Usage:
    python3 scripts/populate-estimate-xlsx.py estimates/optimistic-estimate.md

The script parses the markdown tables in the estimate file and writes rows
to the Backend tab of estimation_template/QED42-Estimate_Template.xlsx.

Column mapping (Backend tab):
    B = Task
    C = Description
    E = Hours (numeric)
    I = Assumptions
    J = Proposed Solution
    K = Reference Links

Row 6 = header row, data starts at row 7.
"""

import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Error: openpyxl is required. Install with: pip install openpyxl")
    sys.exit(1)


def parse_estimate_markdown(md_path: str) -> list[dict]:
    """Parse estimate markdown tables into a list of row dicts."""
    content = Path(md_path).read_text()

    rows = []
    current_domain = None

    # Match domain section headers (## Domain Name)
    domain_pattern = re.compile(r'^## (.+)$', re.MULTILINE)
    # Match markdown table rows — uses [^|] to handle empty cells
    table_row_pattern = re.compile(
        r'^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|$',
        re.MULTILINE,
    )

    # Split content into sections by ## headers
    sections = re.split(r'^## ', content, flags=re.MULTILINE)

    # Skip sections that aren't estimate domains
    skip_sections = {
        'Estimation Approach', 'Summary', 'Assumption Register',
        'Questions Resolved via Assumptions', 'Confidence Assessment',
        'Coverage Checklist',
    }

    for section in sections:
        if not section.strip():
            continue

        # Get section title (first line)
        lines = section.strip().split('\n')
        title = lines[0].strip()

        if title in skip_sections:
            continue

        current_domain = title

        # Find all table rows in this section
        for match in table_row_pattern.finditer(section):
            task = match.group(1).strip()
            description = match.group(2).strip()
            hours_str = match.group(3).strip()
            assumptions = match.group(4).strip()
            proposed_solution = match.group(5).strip()
            reference_links = match.group(6).strip()

            # Skip template placeholder rows, header rows, and separator rows
            if task.startswith('[') or task == 'Task' or task.startswith('---'):
                continue

            # Parse hours as numeric
            try:
                hours = float(hours_str)
            except ValueError:
                hours = 0

            # Skip rows with zero hours (likely category headers)
            if hours == 0 and not description:
                continue

            rows.append({
                'domain': current_domain,
                'task': task,
                'description': description,
                'hours': hours,
                'assumptions': assumptions.replace('<br>', '\n'),
                'proposed_solution': proposed_solution,
                'reference_links': reference_links,
            })

    return rows


def populate_xlsx(rows: list[dict], xlsx_path: str) -> str:
    """Write parsed rows to the Backend tab of the Excel template."""
    wb = openpyxl.load_workbook(xlsx_path)

    if 'Backend' not in wb.sheetnames:
        print(f"Error: 'Backend' sheet not found in {xlsx_path}")
        print(f"Available sheets: {wb.sheetnames}")
        sys.exit(1)

    ws = wb['Backend']

    # Data starts at row 7 (row 6 is header)
    start_row = 7
    current_domain = None

    row_idx = start_row
    for item in rows:
        # Insert domain header row if domain changed
        if item['domain'] != current_domain:
            current_domain = item['domain']
            ws.cell(row=row_idx, column=2, value=current_domain)  # B = domain header
            row_idx += 1

        # Write data columns
        ws.cell(row=row_idx, column=2, value=item['task'])             # B = Task
        ws.cell(row=row_idx, column=3, value=item['description'])      # C = Description
        ws.cell(row=row_idx, column=5, value=item['hours'])            # E = Hours
        ws.cell(row=row_idx, column=9, value=item['assumptions'])      # I = Assumptions
        ws.cell(row=row_idx, column=10, value=item['proposed_solution'])  # J = Proposed Solution
        ws.cell(row=row_idx, column=11, value=item['reference_links'])    # K = Reference Links

        row_idx += 1

    # Update total hours in row 4
    total_hours = sum(item['hours'] for item in rows)
    ws.cell(row=4, column=3, value=total_hours)

    # Save
    output_path = xlsx_path.replace('.xlsx', '-optimistic.xlsx')
    wb.save(output_path)
    return output_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/populate-estimate-xlsx.py <estimate-markdown-file>")
        print("Example: python3 scripts/populate-estimate-xlsx.py estimates/optimistic-estimate.md")
        sys.exit(1)

    md_path = sys.argv[1]
    if not Path(md_path).exists():
        print(f"Error: File not found: {md_path}")
        sys.exit(1)

    # Find the Excel template
    xlsx_path = 'estimation_template/QED42-Estimate_Template.xlsx'
    if not Path(xlsx_path).exists():
        # Try alternate name patterns
        from glob import glob
        candidates = glob('estimation_template/*.xlsx')
        if candidates:
            xlsx_path = candidates[0]
        else:
            print("Error: No Excel template found in estimation_template/")
            sys.exit(1)

    print(f"Parsing estimate: {md_path}")
    rows = parse_estimate_markdown(md_path)
    print(f"Found {len(rows)} estimate line items")

    if not rows:
        print("Warning: No estimate rows found. Check markdown format.")
        sys.exit(1)

    print(f"Populating Excel template: {xlsx_path}")
    output_path = populate_xlsx(rows, xlsx_path)
    print(f"Output saved to: {output_path}")
    print(f"Total hours: {sum(r['hours'] for r in rows)}")


if __name__ == '__main__':
    main()
