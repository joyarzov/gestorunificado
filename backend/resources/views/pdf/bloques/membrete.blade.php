@if($estilo['membrete']['mostrar'] ?? true)
<table class="membrete">
    <tr>
        <td class="membrete-logo">
            @if(($estilo['logo']['mostrar'] ?? true) && !empty($logo_base64))
                <img src="{{ $logo_base64 }}" alt="Logo" style="max-width: {{ $estilo['logo']['max_ancho'] ?? '110px' }};" />
            @endif
        </td>
        <td>
            <div class="inst-nombre">{{ $estilo['membrete']['institucion'] }}</div>
            @if(!empty($estilo['membrete']['subtitulo']))
                <div class="inst-sub">{{ $estilo['membrete']['subtitulo'] }}</div>
            @endif
        </td>
    </tr>
</table>
@if($estilo['regla_azul'] ?? true)<div class="regla-azul"></div>@endif
@endif
