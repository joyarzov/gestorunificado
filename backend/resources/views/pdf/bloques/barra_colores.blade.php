@if($estilo['barra_colores']['mostrar'] ?? true)
<table class="color-bar">
    <tr>
        @foreach($estilo['barra_colores']['colores'] ?? [] as $color)
            <td style="background-color: {{ $color }};"></td>
        @endforeach
    </tr>
</table>
@endif
