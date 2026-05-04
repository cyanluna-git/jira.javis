# PCAS Software Standard — DOCX build
#
# Usage:
#   make all              Build both DOCX files into dist/
#   make pcas-sdp.docx    Build only the SDP DOCX
#   make pcas-scm.docx    Build only the SCM DOCX
#   make clean            Remove generated DOCX files
#   make check            Verify pandoc is installed
#   make test             Run the Phase 6 E2E test suite (T1–T10 + E1–E4)
#
# Output is written to dist/ which is gitignored — DOCX is a derived
# binary artifact and must be rebuilt on demand from the MD sources.

DIST       := dist
SDP_REF    := eastbourne.refer/Eastbourne Site Software Development Procedure (3).docx
SCM_REF    := eastbourne.refer/Software Configuration Management Working Practice (2).docx
PANDOC_FLAGS := --toc --toc-depth=4 --number-sections --standalone -f gfm -t docx

# Pre-processing pipeline applied to each MD before pandoc:
#   1. Strip HTML comments  <!-- ... -->  (one-line traceability cookies)
#   2. Drop the manual "## Table of Contents" block from the line that
#      starts with "## Table of Contents" up to (but not including) the
#      next H2 line, so pandoc's --toc field is the only ToC in the DOCX.
#
# NOTE: GNU make treats `#` as the start of a comment, so the H2 marker
# is escaped as `\#\#` in the awk pattern below.
PREPROCESS = sed -E 's/<!--[^>]*-->//g' $< | awk 'BEGIN{skip=0} /^\#\# Table of Contents$$/{skip=1;next} skip && /^\#\# /{skip=0} skip{next} {print}'

.PHONY: all clean check test pcas-sdp.docx pcas-scm.docx

all: check $(DIST)/pcas-sdp.docx $(DIST)/pcas-scm.docx

# Convenience aliases so `make pcas-sdp.docx` works from the docs/standard dir
pcas-sdp.docx: $(DIST)/pcas-sdp.docx
pcas-scm.docx: $(DIST)/pcas-scm.docx

check:
	@command -v pandoc >/dev/null 2>&1 || { \
		echo "ERROR: pandoc is not installed."; \
		echo "  Linux   : sudo apt-get install -y pandoc"; \
		echo "  macOS   : brew install pandoc"; \
		echo "  Windows : choco install pandoc   (or https://pandoc.org/installing.html)"; \
		echo "Verify with: pandoc --version  (need >= 2.19)"; \
		exit 1; \
	}

$(DIST)/pcas-sdp.docx: pcas-sdp.md | $(DIST)
	$(PREPROCESS) | pandoc $(PANDOC_FLAGS) --reference-doc="$(SDP_REF)" -o $@
	@echo "Built $@"

$(DIST)/pcas-scm.docx: pcas-scm.md | $(DIST)
	$(PREPROCESS) | pandoc $(PANDOC_FLAGS) --reference-doc="$(SCM_REF)" -o $@
	@echo "Built $@"

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -f $(DIST)/*.docx
	@echo "Cleaned $(DIST)/"

# Phase 6 E2E test suite — runs T1–T10 + E1–E4. Locates the script via
# the Makefile's directory so `make -C docs/standard test` works from anywhere.
test:
	@bash $(dir $(realpath $(firstword $(MAKEFILE_LIST))))../../scripts/test-standard-docs.sh
