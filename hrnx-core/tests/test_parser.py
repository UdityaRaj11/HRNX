import pytest
from hrnx.models import Directive, NodeType, Severity
from hrnx.parser import FrontmatterParser


def test_parse_valid_directive():
    raw_md = """---
id: dir.auth.jwt
title: JWT Authentication Policy
type: directive
severity: fatal_invariant
status: active
depends_on:
  - dir.auth.tokens
implements:
  - ADR-001
---

# JWT Authentication Policy

All incoming API requests must validate RS256 signatures.
Refer to @ref:dir.auth.tokens and ADR-001 for specifics.
See also [migration](skill.db.run-migration).
"""
    parser = FrontmatterParser()
    doc = parser.parse_string(raw_md, file_path="nodes/directives/jwt.md")

    assert doc.is_valid is True
    assert doc.node is not None
    assert doc.node.id == "dir.auth.jwt"
    assert doc.node.type == NodeType.DIRECTIVE
    assert isinstance(doc.node, Directive)
    assert doc.node.severity == Severity.FATAL_INVARIANT
    assert doc.node.depends_on == ["dir.auth.tokens"]
    assert doc.node.implements == ["ADR-001"]

    # Check body references
    targets = [r.target_id for r in doc.body_references]
    assert "dir.auth.tokens" in targets
    assert "ADR-001" in targets
    assert "skill.db.run-migration" in targets


def test_parse_yaml_syntax_error():
    raw_md = """---
id: dir.broken
title: Broken
type: directive
invalid_yaml: [unterminated
---

Body content
"""
    parser = FrontmatterParser()
    doc = parser.parse_string(raw_md)

    assert doc.is_valid is False
    assert len(doc.diagnostics) > 0
    assert any("syntax error" in d.message.lower() for d in doc.diagnostics)


def test_parse_unterminated_frontmatter():
    raw_md = """---
id: dir.broken
title: No closing delimiter
"""
    parser = FrontmatterParser()
    doc = parser.parse_string(raw_md)

    assert doc.is_valid is False
    assert any("unterminated" in d.message.lower() for d in doc.diagnostics)


def test_round_trip_serialization():
    raw_md = """---
id: dir.test.roundtrip
title: Roundtrip Directive
type: directive
severity: fatal_invariant
status: active
depends_on:
  - dir.other
---

# Title

Initial markdown content.
"""
    parser = FrontmatterParser()
    doc = parser.parse_string(raw_md)
    assert doc.node is not None

    serialized = parser.serialize_node(doc.node, original_raw=doc.frontmatter_raw)
    assert "id: dir.test.roundtrip" in serialized
    assert "severity: fatal_invariant" in serialized
    assert "Initial markdown content." in serialized

    # Re-parse serialized output
    doc2 = parser.parse_string(serialized)
    assert doc2.is_valid is True
    assert doc2.node.id == doc.node.id
