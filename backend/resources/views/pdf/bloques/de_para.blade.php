<table style="border-collapse:collapse;margin-bottom:18px;">
    <tr>
        <td style="vertical-align:top;padding:0 12px 6px 0;white-space:nowrap;font-weight:bold;color:{{ $estilo['membrete']['color'] }};">{{ $props['label_de'] ?? 'DE:' }}</td>
        <td style="vertical-align:top;padding:0 0 6px 0;">{!! nl2br(e($datos[$props['de_var'] ?? 'de'] ?? '')) !!}</td>
    </tr>
    <tr>
        <td style="vertical-align:top;padding:0 12px 0 0;white-space:nowrap;font-weight:bold;color:{{ $estilo['membrete']['color'] }};">{{ $props['label_para'] ?? 'PARA:' }}</td>
        <td style="vertical-align:top;padding:0;">{!! nl2br(e($datos[$props['para_var'] ?? 'para'] ?? '')) !!}</td>
    </tr>
</table>
