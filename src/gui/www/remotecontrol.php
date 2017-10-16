<?
    try {
        $user = "your user name";
        $pwd  = "your password";
        $path = "your directory of caliper ";
        $host = "host's ip address"
        $port = 22; // host's ssh port
        set_time_limit( 0);
        // clear data
        $tmp = fopen("log.txt", "w");
        fwrite($tmp, "");
        fclose($tmp);
        $tmp = fopen("demo.json", "w");
        fwrite($tmp, "");
        fclose($tmp);

        $connect = ssh2_connect($host, $port);
        $hasReport = false;
        if(ssh2_auth_password($connect, $user, $pwd)){
            // start the benchmark
            $stream = ssh2_exec($connect, $path.'start.sh ' . $_GET['b']);
            stream_set_blocking($stream, true);
            //$stream_out = ssh2_fetch_stream($stream, SSH2_STREAM_STDIO);
            //$stream_err = ssh2_fetch_stream($stream, SSH2_STREAM_STDERR);

            // fetch the log file to get running result
            while($stream) {
                sleep(1);
                $out = ssh2_exec($connect, 'cat '.$path.'output.log');
                stream_set_blocking($out, true);
                $result = stream_get_contents($out);
                $file = fopen("log.txt", "w");
                fwrite($file, $result);
                fclose($file);
                fclose($out);

                $demo = ssh2_exec($connect, 'cat '.$path.'src/gui/output/demo.json');
                stream_set_blocking($demo, true);
                $demoResult = stream_get_contents($demo);
                $demoFile = fopen("demo.json", "w");
                fwrite($demoFile, $demoResult);
                fclose($demoFile);
                if(!$hasReport) {
                    $json = json_decode($demoResult);
                    $report = $json->report;
                    if(strpos($report, '.html') !== false ) {
                        $html = ssh2_exec($connect, 'cat '.$report);
                        stream_set_blocking($html, true);
                        $htmlData = stream_get_contents($html);
                        $htmlFile = fopen("report.html", "w");
                        fwrite($htmlFile, $htmlData);
                        fclose($htmlFile);
                        fclose($html);
                        $hasReport = true;
                    }
                }
                fclose($demo);

                if(strpos($result, '# fail  ') !== false || strpos($result, '# ok') !== false) {
                    sleep(2);
                    break;
                }
            }

            stream_get_contents($stream);
            fclose($stream);

            if($hasReport) {
                echo "ok";
            }
            else {
                echo "finished";
            }
            //echo "output:" . stream_get_contents($stream_out);
            //echo "error:" . stream_get_contents($stream_err);
            //$value = stream_get_contents($stream_out);
            //echo $value;
        }
        else {
            echo "error";
        }
    }
    catch(Exception $e) {
        echo "error";
    }

?>
