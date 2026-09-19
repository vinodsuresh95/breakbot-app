"""SMTP email delivery."""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def send_email(*, to: str, subject: str, body: str) -> dict:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("EMAIL_FROM", user)
    from_name = os.getenv("EMAIL_FROM_NAME", "Vinod — BreakBot")

    if not all([host, user, password, from_addr]):
        return {
            "sent": False,
            "simulated": True,
            "message": "SMTP not configured — email drafted only. Set SMTP_* env vars to send for real.",
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(from_addr, [to], msg.as_string())

    return {"sent": True, "simulated": False, "message": f"Email sent to {to}"}
