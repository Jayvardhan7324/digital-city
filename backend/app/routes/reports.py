from fastapi import APIRouter
from typing import List
from ..models.report import ReportCreate, ReportResponse
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["reports"])

# In-memory store fallback if DB is not connected
MOCK_REPORTS = []

@router.post("/", response_model=ReportResponse)
def create_report(report: ReportCreate):
    new_report = ReportResponse(
        id=len(MOCK_REPORTS) + 1,
        created_at=datetime.utcnow(),
        status="OPEN",
        **report.model_dump()
    )
    MOCK_REPORTS.append(new_report)
    return new_report

from typing import List, Optional

@router.get("/", response_model=List[ReportResponse])
def get_reports(category: Optional[str] = None):
    if category:
        return [r for r in MOCK_REPORTS if r.category == category]
    return MOCK_REPORTS
