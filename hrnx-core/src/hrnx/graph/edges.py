from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EdgeType(str, Enum):
    DEPENDS_ON = "depends_on"
    IMPLEMENTS = "implements"
    VALIDATED_BY = "validated_by"
    VALIDATES = "validates"
    USES_TOOL = "uses_tool"
    OVERRIDES = "overrides"
    COMPILED_TO = "compiled_to"
    CONTEXT_SCOPE = "context_scope"


class EdgeMetadata(BaseModel):
    edge_type: EdgeType
    source_id: str
    target_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
