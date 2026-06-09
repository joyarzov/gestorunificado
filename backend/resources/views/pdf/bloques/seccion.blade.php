<div class="bloque {{ ($props['small'] ?? false) ? 'small' : '' }}"@isset($props['margin_top']) style="margin-top: {{ $props['margin_top'] }};"@endisset>
    @if(!empty($props['titulo']))
        <div class="seccion-titulo {{ ($props['titulo_align'] ?? '') === 'center' ? 'center' : '' }}">{{ $props['titulo'] }}</div>
    @endif
    <div class="seccion-cuerpo {{ ($props['indent'] ?? false) ? 'indent' : '' }} {{ ($props['justify'] ?? false) ? 'justify' : '' }}">
        @isset($props['var']){!! nl2br(e($datos[$props['var']] ?? '')) !!}@endisset
        @isset($props['var_html']){!! $datos[$props['var_html']] ?? '' !!}@endisset
        @isset($props['texto']){!! $interp($props['texto']) !!}@endisset
    </div>
</div>
