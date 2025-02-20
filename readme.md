# Explicação do Monitoramento de Preços

O código atual já monitora corretamente tanto aumentos quanto quedas nos preços. Veja como funciona:

1. A função `calculateChange` retorna:
   - Valores positivos quando o preço aumenta
   - Valores negativos quando o preço diminui

   Por exemplo:
   - Se o preço antigo era 100 e o novo é 110, retorna +10%
   - Se o preço antigo era 100 e o novo é 90, retorna -10%

2. Na função `monitorPrices`, o `Math.abs()` é usado para verificar se a mudança (seja positiva ou negativa) excede o THRESHOLD:
   ```typescript
   if (Math.abs(calculateChange(currentPrices.bitcoin, lastPrices.bitcoin)) > THRESHOLD)
   ```

   - O `Math.abs()` converte números negativos em positivos
   - Então, uma queda de -15% será convertida para 15% e comparada com o THRESHOLD
   - Isso significa que o alerta será disparado tanto para aumentos quanto para quedas que excedam o limite

3. Quando o alerta é enviado, o valor real da mudança (positivo ou negativo) é usado:
   ```typescript
   changes.bitcoin = calculateChange(currentPrices.bitcoin, lastPrices.bitcoin);
   ```

   Isso significa que a mensagem de alerta mostrará:
   - Valores positivos para aumentos (ex: +12%)
   - Valores negativos para quedas (ex: -12%)

