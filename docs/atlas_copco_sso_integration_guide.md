# 🔐 Atlas Copco Azure AD SSO Integration Guide for GitLab

## 1. Overview
GitLab Self-Managed 인스턴스와 Atlas Copco의 **Microsoft Entra ID (Azure AD)**를 연동하여, **MFA(Multi-Factor Authentication)**가 적용된 안전한 로그인 환경을 구축하는 가이드입니다. 회사의 IT 표준 프로세스(ServiceNow Request)를 준수합니다.

---

## 2. IT Request Process (Step-by-Step)

### 📋 Step 1: CMDB 등록 (필수 선행)
GitLab을 회사의 정식 애플리케이션으로 등록하여 **Application ID**를 발급받아야 합니다.
*   **Form:** `Request to add Application in CMDB`
*   **Application Name:** `GitLab - PCAS`
*   **Description:** "DevOps platform for source code management and CI/CD."
*   **Owner:** Gerald Park

### 🔑 Step 2: App Registration (SSO 신청)
CMDB ID가 나오면, SSO를 위한 App Registration을 신청합니다.
*   **Form:** `Service Principal / App Registration request Form`
*   **Application ID:** (Step 1에서 받은 ID 입력)
*   **Redirect URI (Web):**
    *   *Azure VM 도메인 확정 후 입력 (예: `https://gitlab.pcas.edwardsvacuum.com/users/auth/azure_activedirectory_v2/callback`)*
    *   **중요:** `http` 대신 **`https`** 필수. (Let's Encrypt SSL 적용 예정)
*   **Permissions:** `User.Read (Delegated)` (기본값, 자동 승인)
*   **Justification:** "Enable SSO with MFA for GitLab users."

### 👥 Step 3: Group Creation (권한 관리)
GitLab 접근 권한을 제어할 Azure AD 그룹을 생성합니다.
*   **Form:** `Microsoft Entra ID manage normal group`
*   **Action:** Create
*   **Group Type:** Security
*   **Naming Convention (Standard):**
    *   **`AAP-GitLab-Admins`**: Full Access (Owner)
    *   **`AAP-GitLab-Developers`**: Read/Write (Developer)
    *   *(AAP = Azure Application Prefix)*
*   **Owner:** Gerald Park
*   **Justification:** "RBAC group for GitLab application access."

---

## 3. GitLab Configuration (Technical)

App Registration이 완료되면 **Application (Client) ID**와 **Directory (Tenant) ID**, **Client Secret**을 받게 됩니다. 이를 GitLab에 설정합니다.

### ⚙️ `gitlab.rb` (또는 `gitlab-compose.yml`) 설정

```yaml
# gitlab-compose.yml 예시
environment:
  GITLAB_OMNIBUS_CONFIG: |
    # ... 기존 설정 ...
    
    # Azure AD SSO Configuration
    gitlab_rails['omniauth_enabled'] = true
    gitlab_rails['omniauth_allow_single_sign_on'] = ['azure_activedirectory_v2']
    gitlab_rails['omniauth_block_auto_created_users'] = false # 자동 가입 허용
    gitlab_rails['omniauth_providers'] = [
      {
        "name" => "azure_activedirectory_v2",
        "label" => "Edwards SSO (MFA)", # 로그인 버튼 텍스트
        "args" => {
          "client_id" => "YOUR_APP_ID",
          "client_secret" => "YOUR_CLIENT_SECRET", # Key Vault에서 가져온 값
          "tenant_id" => "YOUR_TENANT_ID",
        }
      }
    ]
```

### 🔄 Group Sync (Optional)
Azure AD 그룹(`AAP-GitLab-Developers`)에 속한 사람을 GitLab의 특정 그룹에 자동으로 넣고 싶다면, GitLab Premium 기능인 **SAML Group Sync**를 써야 합니다. (Free 버전에서는 사용자가 로그인하면 수동으로 GitLab 그룹에 초대해야 합니다.)

---

## 4. Post-Setup Checklist
- [ ] **Secret Management:** 발급받은 Client Secret은 `Azure Key Vault` 또는 `PAM`에 저장하고, 절대 Teams/Email로 공유하지 않음.
- [ ] **MFA Verification:** SSO 로그인 시 Authenticator 앱 알림이 오는지 확인.
- [ ] **User Mapping:** 기존 로컬 계정(`gerald.park`)과 SSO 계정이 이메일(`gerald.park@edwardsvacuum.com`) 기준으로 자동 연결되는지 확인.

---

## 💡 Troubleshooting
*   **Redirect URI Mismatch:** Azure에 등록한 주소와 실제 GitLab 주소가 토씨 하나라도 다르면 에러 (`https` 주의).
*   **Email Mismatch:** Azure AD의 UPN(User Principal Name)과 GitLab 이메일이 다르면 새 계정이 생성될 수 있음.
