Tiny golden inputs, generated for this repo (no third-party content).
`doc/sample.doc`, `xls/`, `ppt/` hold a 512-byte CFB header stub, and `docx/sample.docx` is a zip stub: enough for detection, not openable Office files.

The real, openable documents are `report.{doc,docx,odt,rtf}`, `sheet.{xlsx,ods}` and `slides.{pptx,odp}`, each a few KB with text written for this repo. They were made once with LibreOffice 24.2 (`soffice --headless --convert-to <ext>`) from a plain text file (`report.*`), a csv (`sheet.*`) and a hand-written flat `slides.fodp` (`slides.*`). They are inputs for the office → pdf golden tests.
