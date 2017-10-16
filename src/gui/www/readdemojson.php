<?
    $value = file_get_contents('demo.json');
    echo iconv("GBK", "UTF-8", $value);
?>
