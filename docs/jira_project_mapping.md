# 🗺️ Jira to GitLab Project Mapping (Final)

Jira 프로젝트를 GitLab의 어떤 그룹과 프로젝트로 이관할지 정의하는 최종 매핑 테이블입니다.

| Jira Key | Jira Project Name | Type | Target GitLab Group | Target Project Name | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NSS** | General & Common Platform | Software | `Integrated System` | `common-platform` | 🟡 Ready |
| **EUV** | PCAS Software Team | Software | `Integrated System` | `pcas-software` | 🟡 Ready |
| **PROT** | Proteus | Software | `Abatement` | `proteus` | 🟡 Ready |
| **PSSM** | Software Inquery/Request Potal | Service Desk | `Integrated System` | `software-helpdesk` | 🟡 Ready |
| **ASP** | Abatement Software Project | Software | `Abatement` | `abatement-core` | 🟡 Ready |

## ✅ Action Items
1. GitLab 웹 UI에서 **New Project > Import project > Jira**를 선택합니다.
2. 위 표의 매핑 정보를 기반으로 하나씩 임포트를 실행합니다.
3. `PSSM (software-helpdesk)` 프로젝트는 이관 완료 후 **Settings > General > Service Desk** 메뉴에서 기능을 활성화합니다.
4. 이관 완료된 프로젝트는 Jira에서 "Archived" 처리하여 혼선을 방지합니다.