# Arquitectura

## Vista general
```mermaid
flowchart LR
  subgraph Repo["Repositorio GitHub"]
    K["knowledge/: estándares, política, incidentes"]
    T["templates/: workflows y Dependabot"]
    E["scripts/engine.mjs: motor compartido"]
  end
  K --> B["build-kb.mjs"] --> P["Portal (GitHub Pages)"]
  T --> B
  E --> P
  E --> A["agent.mjs en GitHub Actions"]
  K --> A
  U1(["Desarrollador"]) -->|pregunta| P
  U1 -->|abre Issue de pase| I["Issue + formulario"]
  I -->|evento issues| A
  A -->|informe, etiquetas| I
  A -.->|opcional| M["GitHub Models"]
```

## Flujo del pase
```mermaid
sequenceDiagram
  participant D as Desarrollador
  participant I as Issue
  participant A as Agente (Actions)
  participant S as Squads (QA, SecOps, CAB)
  D->>I: Abre ticket con el formulario
  I->>A: Evento issues opened/edited
  A->>A: Lee política e historial, calcula riesgo
  A->>I: Comenta informe y etiquetas
  alt Hay bloqueos
    D->>I: Corrige y edita el ticket
    I->>A: Reevalúa
  else Sin bloqueos
    I->>S: Aprobaciones según el nivel de riesgo
  end
```

## Piezas
| Pieza | Archivo | Función |
|---|---|---|
| Estándares | `knowledge/0*.md` | Fuente única de verdad, versionada y revisable por pull request |
| Política de riesgo | `knowledge/policy.json` | Pesos, bloqueos y aprobaciones por nivel |
| Historial | `knowledge/incidents.json` | Incidentes que alimentan la prevención |
| Motor | `scripts/engine.mjs` | Búsqueda, lectura del formulario, riesgo e informe. Mismo código en navegador y en Actions |
| Agente | `scripts/agent.mjs` + `.github/workflows/agente-pase.yml` | Evalúa y publica en el Issue |
| Portal | `docs/` | Chat, validador y plantillas |
| Plantillas | `templates/` | CI de seguridad, release, Dependabot |
| Copilot | `.github/copilot-instructions.md`, `.github/agents/` | Los agentes de Copilot de la entidad usan la misma base |

## Cálculo del riesgo (transparente)
Puntaje de 0 a 100 = criticidad + tamaño + rollback + día de riesgo + controles faltantes + incidentes recientes del servicio. Todos los pesos están en `policy.json`.
- Bajo hasta 29, Medio hasta 54, Alto hasta 74, Crítico por encima.
- **Bloquea** sin importar el puntaje: falta de QA, SAST, SCA, secretos, aprobación del squad o rollback.
- Cada nivel define las aprobaciones requeridas.

## Qué es IA y qué es regla
- Reglas deterministas: puntaje, bloqueos y aprobaciones. Son auditables y reproducibles.
- IA generativa (opcional): solo redacta los siguientes pasos con la política recuperada como contexto. Si falla, el informe sale igual.
