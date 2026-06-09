<div class="ref-fecha" style="text-align: {{ $props['align'] ?? 'right' }};">
    @foreach($props['items'] ?? [] as $item)
        <p>
            <strong>{{ $item['label'] ?? '' }}</strong>
            @isset($item['var']){{ $datos[$item['var']] ?? '' }}@endisset
            @isset($item['texto']){{ $item['texto'] }}@endisset
        </p>
    @endforeach
</div>
