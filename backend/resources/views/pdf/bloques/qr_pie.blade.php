@if(!empty($codigo_verificacion))
<div class="pie">
    <table class="pie-table">
        <tr>
            <td class="pie-qr" style="width: 70px;">
                @if(!empty($qr_data_uri))
                    <img src="{{ $qr_data_uri }}" alt="QR de verificación" />
                    <div class="pie-cod">{{ $codigo_verificacion }}</div>
                @endif
            </td>
            <td class="pie-verif">
                {{ $props['texto'] ?? 'Verifique la autenticidad de este documento en' }}<br/>
                {{ $verificar_url ?? '' }}<br/>
                C&oacute;digo: <strong>{{ $codigo_verificacion }}</strong>
            </td>
        </tr>
    </table>
</div>
@endif
