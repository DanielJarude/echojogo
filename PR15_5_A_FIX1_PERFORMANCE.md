# ECHO — PR15.5-A-FIX #1 · Performance

## Sintoma

O playtest humano A/B identificou FPS normal no commit-base `4667720b` e uma
leve queda perceptível no PR15.5-A (`ea1a1b9`) quando havia muitos inimigos.
Os testes anteriores demonstravam estabilidade lógica, não custo real do hot
path.

## Causa raiz

A inicialização declarada como lazy não era lazy no runtime:

1. `updateEnemy` chamava `visualTimelineTick` para toda entidade;
2. `visualTimelineTick` chamava `visualState`, criando `e.visual` mesmo idle;
3. `drawEnemy` chamava `visualHurtPose` em todos os draws;
4. a ausência de hurt ainda sanitizava uma pose neutra inteira;
5. três transforms Canvas extras (`translate`, `rotate`, `scale`) eram sempre
   emitidos por inimigo, mesmo neutros;
6. `drawUnit` também sanitizava pose e emitia transforms neutros para jogador,
   Echos e Ecos Sombrios;
7. notificações de hit/disparo criavam literais temporários;
8. `weaponVisualProfile` reconstruía um objeto a cada consulta.

Com 46 inimigos idle, isso significava 46 estados criados, 46 validações de
timeline, 46 poses sanitizadas e 138 transforms Canvas adicionais por frame.

## Correção

- `visualPeek` lê sem criar;
- `visualTimelineTick` retorna imediatamente sem estado;
- estado existente, inativo e sem evento/recoil usa um segundo fast path;
- `visualHurtPose` retorna `null` antes de easing/trigonometria quando inativo;
- `drawEnemy` só emite transforms de pose quando há hurt ativo;
- `drawUnit` não sanitiza nem transforma pose ausente;
- `visualWeaponRecoil` faz leitura direta e retorna zero cedo;
- `visualNotifyHurt` e `visualNotifyWeaponFire` evitam objeto de dados temporário
  nos eventos quentes;
- perfis das 27 armas são pré-calculados uma vez num `Map` fixo;
- definições externas usam um fallback único e não aumentam o cache.

A intensidade e duração aprovadas de hurt e recoil foram preservadas.

## Benchmark

O script `audit_pr155/visual_foundation_benchmark.js` mede medianas locais sem
impor limite absoluto de CI. Ele cobre 1/10/46 inimigos idle, estado inativo,
hurt ativo, pose, profile lookup, disparo do jogador, disparo de Echo e stress
misto.

Uma execução de referência no sandbox produziu:

| Cenário | Mediana local |
|---|---:|
| 1 idle sem state | 21,101 ms / lote |
| 10 idle sem state | 23,085 ms / lote |
| 46 idle sem state | 25,068 ms / lote |
| 46 com state inativo | 98,305 ms / lote |
| 46 com hurt ativo | 520,524 ms / lote |
| pose idle fast path | 32,395 ms / lote |
| pose hurt ativo | 445,722 ms / lote |
| profile cacheado | 6,435 ms / lote |
| disparo player | 28,514 ms / lote |
| disparo Echo | 25,501 ms / lote |
| misto: 40 idle + 6 hurt | 110,010 ms / lote |

Os lotes têm iterações diferentes e servem para comparação diagnóstica interna,
não como tempos por frame. Não houve medição de FPS real do Electron neste
ambiente; o replaytest humano permanece a validação final.

## Contadores conceituais: 46 inimigos idle

| Métrica | Antes do FIX | Depois do FIX |
|---|---:|---:|
| Visual states criados | 46 | 0 |
| Ticks com validação completa | 46/frame | 0/frame |
| Poses calculadas/sanitizadas | 46/frame | 0/frame |
| Transforms Canvas adicionais | 138/frame | 0/frame |
| Trigonometria de hurt | 46 consultas/frame | 0 |
| Objetos de evento por hit/disparo | 1 literal/evento | 0 |
| Perfil de arma | novo objeto/consulta | lookup de objeto pré-calculado |
| Limite do cache | não havia cache | exatamente 27 entradas |

Entidades que já sofreram um evento mantêm um objeto pequeno inativo, mas seu
tick retorna cedo e não calcula pose nem aplica transforms.

## Testes

`tests/pr15-5-a-fix1-performance.test.js` adiciona 28 checks para lazy real,
fast paths, contagem de transforms, expiração, scratch, eventos sem objeto,
cache limitado, finitude, stress e invariantes mecânicos. Os 95 checks originais
do PR15.5-A permanecem ativos.

## Limitações

- benchmark Node/Canvas mock não equivale a FPS real no Electron;
- hurt ativo ainda paga easing, uma `atan2`, `sin`/`cos` e três transforms, por
  apenas 0,11 s — custo intencional e localizado;
- o fix não otimiza renderers legados, partículas, blur ou separação O(n²);
- o objeto visual inativo não é removido, para evitar churn de alocação após
  eventos repetidos; o fast path torna seu custo mínimo.
